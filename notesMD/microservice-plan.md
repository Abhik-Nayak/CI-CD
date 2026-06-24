# Microservice Migration Plan

> Goal: split the monolith Express API into 2 microservices to learn microservice architecture in Docker.
> DB: single local Postgres (laptop for local, EC2's local Postgres for deploy). No RDS, no DB containers.
> Branch: `docker-microservice-dev`

---

## Target architecture (dedicated gateway tier)

```
Browser
  │  :80
  ▼
client (nginx) ── serves React static, forwards /api ──┐
                                                        ▼
                                          gateway (nginx)  ← single backend entry
                                            ├── /api/auth  → auth-service:5002
                                            └── /api/todos → todo-service:5001
                                                   │              │
                                                   ▼              ▼
                                                auth_db        todo_db   (2 DBs, one local Postgres)
                                                (users)        (todos)
```

Folder layout:
```
services/
├── gateway/        nginx — routes /api/* to services (the gateway tier)
├── auth-service/
└── todo-service/
client/             React + nginx (static only; forwards /api → gateway)
```

- The **client** knows only one backend: the gateway. It has no idea how many services exist.
- The **gateway** is the only thing that knows service addresses; services are never exposed to clients.
- Database-per-service is applied **logically**: two separate databases on one Postgres, not new servers.
- In bigger systems the gateway role is played by Kong / Traefik / AWS API Gateway — same job, more features.

---

## Steps

### 1. Databases
Create two databases on local Postgres (and EC2 later):
- `auth_db` — owns `users`
- `todo_db` — owns `todos`

### 2. Restructure folders
```
auth-service/   ← signup, login, JWT issue   (from server/routes/auth.js)
todo-service/   ← todo CRUD                    (from server/routes/todos.js)
client/         ← unchanged
```
Each service gets its own `Dockerfile`, `db.js`, `package.json`, `.env`.

### 3. Tables
- `auth_db`: `users`
- `todo_db`: `todos` — **drop `REFERENCES users(id)`**. Keep `user_id` as a plain column, filled from the verified JWT.
- Reason: `users` and `todos` now live in different databases → no cross-DB foreign key / JOIN possible. This is the core decoupling lesson.

### 4. Auth between services
- auth-service signs the JWT (owns `JWT_SECRET`).
- todo-service verifies the same JWT (shares `JWT_SECRET`), reads `user_id` from the token. No DB call to auth-service.

### 5. nginx gateway (`client/nginx.conf`)
```
/api/auth   → auth-service:5002
/api/todos  → todo-service:5001
```

### 6. Compose (both `docker-compose.yml` + `docker-compose.prod.yml`)
- services: `auth-service`, `todo-service`, `client`
- each service: own `DB_NAME`, same `DB_HOST: host.docker.internal`, same `JWT_SECRET`.

### 7. CI/CD
- No change needed — same `docker compose up --build` deploy.

---

## Next: Resilience — handle a service failing in prod

Scenario: app is live, todo-service is up but **auth-service fails**.

What happens already (thanks to decoupling): todo-service verifies the JWT locally
(no call to auth-service), so **logged-in users keep using todos**. Only NEW
login/signup returns 502. Blast radius is small by design.

Execution plan, ordered by value for the current single-EC2 + compose setup:

- [x] **Layer 1 — Auto-restart** — `restart: unless-stopped` already set in `docker-compose.prod.yml`.
- [ ] **Layer 2 — Health checks** — add `HEALTHCHECK` to each service so Docker restarts on *actual* breakage (frozen / DB unreachable), not just process death. Tests the existing `/api/health` endpoint.
  ```yaml
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:5002/api/health"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 10s
  ```
- [ ] **Layer 3 — Graceful failure at the gateway + UI** — add `proxy_connect_timeout` / `proxy_read_timeout` in the gateway so a slow/dead service fails fast; show a friendly "login temporarily unavailable" in React instead of a raw 502.
- [ ] **Layer 4 — Redundancy (true HA)** — multiple replicas of each service so one dying still leaves others serving. NOT possible with single-EC2 compose → needs an orchestrator (**ECS / Kubernetes**) across multiple nodes. This is the natural next learning step after Docker.
- [ ] **Layer 5 — Monitoring & alerts** — poll `/api/health` (UptimeRobot / CloudWatch / Prometheus) and alert when a service is unhealthy.

Priority now: **Layers 2 + 3 + 5** (doable on current setup). Layer 4 = future, with an orchestrator.

---

## Note
For a tiny todo app, microservices are over-engineering — in the real world this stays a monolith.
This is a **learning exercise** to understand the mechanics, not a template for small apps.
