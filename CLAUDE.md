# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A PERN (Postgres/Express/React/Node) todo app deliberately split into microservices as a **learning exercise** for Docker microservice architecture. It is intentionally over-engineered for its size — treat the decoupling patterns below as the point, not as something to "simplify away" (see [notesMD/microservice-plan.md](notesMD/microservice-plan.md)).

## Architecture

Request flow — the browser only ever talks to the client; everything behind it is hidden:

```
Browser :80
  └─ client (nginx)  serves React SPA, forwards /api → gateway
       └─ gateway (nginx)  single backend entry point, routes by path prefix:
            ├─ /api/auth  → auth-service:5002   (owns the users table)
            └─ /api/todos → todo-service:5001   (owns the todos table)
```

Key invariants — most "why is it built this way" questions trace back to these:

- **Single shared database, one table per service.** Both services connect to the **same** database (`devdb`, set via `DB_NAME` in each `.env`) on a single Aurora PostgreSQL cluster (ap-south-1). auth-service owns the `users` table, todo-service owns the `todos` table — the isolation is logical (each service only touches its own table), not physical. Both dev and prod use the same cluster endpoint via `DB_HOST`; connections require TLS (`DB_SSL=true` → `pg` pool sets `ssl: { rejectUnauthorized: false }` in `db.js`). There are no DB containers and no `host.docker.internal` override anymore.
- **No cross-service foreign keys.** `todos.user_id` is a plain `INTEGER` column with **no** `REFERENCES users(id)` — even though `users` lives in the same database, todo-service deliberately does not couple to auth-service's table. The value is trusted from the verified JWT, never validated against the users table.
- **Services authenticate via shared JWT secret, not network calls.** auth-service signs JWTs ([services/auth-service/routes/auth.js](services/auth-service/routes/auth.js)); todo-service verifies them locally with the same `JWT_SECRET` ([services/todo-service/middleware/auth.js](services/todo-service/middleware/auth.js)) and reads `user_id` from the token. todo-service never calls auth-service — this is what keeps the blast radius small (logged-in users keep working even if auth-service is down).
- **Each service is self-contained:** its own `Dockerfile`, `db.js`, `package.json`, `.env`, and `routes/`. They share no code.
- **Tables are auto-created on boot** via `CREATE TABLE IF NOT EXISTS` in each service's `index.js` `start()` — there are no migration files.
- **Frontend routing knows nothing about services.** All calls go through [client/src/api/client.js](client/src/api/client.js) with relative `/api/...` paths; the gateway (or Vite proxy in local dev) handles routing. A 401 dispatches a window `auth:unauthorized` event that `AuthContext` listens for to log out.

## Local development (no Docker)

Both services connect to the shared Aurora cluster (the `devdb` database must already exist on it). Each service needs a `.env` with `PORT`, `DB_USER`/`DB_PASS`/`DB_HOST`/`DB_PORT`/`DB_NAME`, `DB_SSL=true`, and `JWT_SECRET` (**must be identical** in both services). `db.js` throws on startup if any `DB_*` var is missing. Reaching Aurora from a laptop requires the cluster's security group to allow inbound 5432 from your IP.

Run each piece in its own terminal:

```bash
# auth-service  (port 5002)
cd services/auth-service && npm install && npm run dev   # nodemon

# todo-service  (port 5001)
cd services/todo-service && npm install && npm run dev

# client  (Vite dev server, proxies /api/auth→5002 and /api/todos→5001 — see vite.config.js)
cd client && npm install && npm run dev
```

The Vite dev proxy ([client/vite.config.js](client/vite.config.js)) mirrors what the nginx gateway does in Docker, so there is no gateway process locally.

Client lint: `cd client && npm run lint`. **There is no test suite** anywhere in the repo — do not assume `npm test` exists.

> The root `package.json` (`npm run dev`, `pm2:*` scripts) refers to an older monolith `server/` layout that no longer exists. Use the per-service commands above, not the root scripts.

## Running with Docker

```bash
docker compose up --build              # dev  (docker-compose.yml)
docker compose -f docker-compose.prod.yml up --build -d   # prod
```

Only the **client** container is published to the host (port `80`; dev also exposes `8080`, a teaching forward-proxy). gateway, auth-service, and todo-service are reachable only on the internal `todo-network` and resolve each other by Docker Compose service name. Service `.env` files are loaded via `env_file`, with `DB_HOST` overridden to `host.docker.internal`.

## Deployment / CI

[.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml) deploys on **push to the `dev` branch**. It SSHes into an EC2 host (secrets: `EC2_HOST`/`EC2_USER`/`EC2_SSH_KEY`), pulls `dev`, and runs `docker compose -f docker-compose.prod.yml up --build -d --remove-orphans`. The GitHub runner does no build/checkout — everything happens on EC2.

Branches: `prod` is the main branch (PR target); `dev` triggers deploys; `docker-microservice-dev` is the current feature branch. EC2 host bootstrap is documented in [EC2-AL2023-SETUP.md](EC2-AL2023-SETUP.md).

## Health & resilience

Each service exposes `GET /api/health` (uptime, memory, DB latency) — used for monitoring and the planned Docker healthchecks. The resilience roadmap (healthchecks → graceful gateway timeouts → replicas/orchestrator → monitoring) lives in [notesMD/microservice-plan.md](notesMD/microservice-plan.md).
