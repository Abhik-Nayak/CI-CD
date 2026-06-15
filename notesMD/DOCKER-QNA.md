# Docker — Interview Q&A & Fundamentals

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Dockerfile](#2-dockerfile)
3. [Environment Variables](#3-environment-variables)
4. [Networking](#4-networking)
5. [Docker Compose](#5-docker-compose)
6. [nginx](#6-nginx)
7. [Volumes](#7-volumes)
8. [Scenario-Based Questions](#8-scenario-based-questions)
9. [Mistakes You Made & Why](#9-mistakes-you-made--why)
10. [Quick Revision Table](#10-quick-revision-table)

---

## 1. Core Concepts

**Q: What is Docker?**
> Docker packages your app and everything it needs (runtime, dependencies, config) into an image. That image runs identically on any machine. Eliminates "works on my machine" problems.

---

**Q: What is the difference between an Image and a Container?**
> An **image** is a static snapshot — like a blueprint or a class in OOP. A **container** is a running instance of that image — like an object created from a class. You build an image once and can run many containers from it.

```
Image  →  docker run  →  Container
Class  →  new Class() →  Object
```

---

**Q: What is the difference between `docker build` and `docker run`?**
> `docker build` reads your Dockerfile and creates an image (stored on disk).
> `docker run` takes an image and starts a running container from it.

---

**Q: What is a layer in Docker?**
> Every instruction in a Dockerfile creates a layer. Docker caches each layer. If a layer hasn't changed, Docker reuses the cached version — making subsequent builds faster. This is why you copy `package.json` before source code: the `npm install` layer only re-runs when dependencies change, not on every code edit.

---

**Q: What is `.dockerignore` and why is it important?**
> `.dockerignore` tells Docker which files NOT to send to the build context. Without it:
> - `node_modules` (50k+ files) gets sent to the Docker daemon — slow build
> - `COPY . .` overwrites the clean `npm ci` install with devDependencies
> - `.env` secrets could leak into the image
>
> Always create `.dockerignore` before your first `docker build`.

---

**Q: What is the build context?**
> The folder you pass to `docker build` (e.g., `./server`). Docker sends all files in that folder (except `.dockerignore` exclusions) to the Docker daemon before building. Large build contexts = slow builds.

---

## 2. Dockerfile

**Q: What is a multi-stage build and why use it?**
> A multi-stage build uses multiple `FROM` instructions in one Dockerfile. Each stage can copy artifacts from previous stages. Benefits:
> - Final image only contains what's needed to run — not build tools
> - `devDependencies` (nodemon, eslint, vite) stay in the builder stage and never reach production
> - Smaller, more secure final image

```dockerfile
FROM node:22-alpine AS deps     # Stage 1 — install
RUN npm ci --omit=dev

FROM node:22-alpine             # Stage 2 — run (fresh image, no build tools)
COPY --from=deps /app/node_modules ./node_modules
```

---

**Q: What is the difference between `CMD` and `ENTRYPOINT`?**
> `CMD` sets the default command — it can be overridden by passing a command to `docker run`.
> `ENTRYPOINT` sets the fixed executable — it cannot be overridden easily.
> For most Node.js apps, `CMD ["node", "index.js"]` is correct.

---

**Q: What is the difference between exec form and shell form in CMD?**
> Exec form: `CMD ["node", "index.js"]` — node becomes PID 1, receives OS signals (SIGTERM) directly → graceful shutdown when `docker stop` runs.
> Shell form: `CMD node index.js` — runs inside `/bin/sh -c`, shell becomes PID 1, node never receives SIGTERM → container gets force-killed after 10s timeout.
> Always use exec form for production.

---

**Q: What does `USER node` do in a Dockerfile?**
> Switches from root to the built-in `node` user for all subsequent instructions and at runtime. Security best practice — if an attacker exploits your app, they get a restricted user instead of root access to the host.

---

**Q: Why do we `COPY package*.json ./` before `COPY . .`?**
> Docker layer caching. If you copy everything at once, any code change invalidates the `npm install` layer and Docker reinstalls all packages from scratch. By copying only `package.json` first, the install layer is only busted when dependencies actually change.

```
Wrong order → code change → reinstall all packages every build
Right order → code change → reuse cached node_modules layer
```

---

**Q: What does `--omit=dev` do in `npm ci --omit=dev`?**
> Skips installation of `devDependencies` (nodemon, eslint, vite, etc.). These are only needed during development and testing — not in the production container. Keeps the image smaller and attack surface smaller.

---

**Q: What is the difference between `npm ci` and `npm install`?**
> `npm ci` reads `package-lock.json` exactly — never resolves differently, fails if lockfile is out of sync with `package.json`. Used in Docker/CI for reproducible builds.
> `npm install` can update the lockfile and resolve version ranges. Used locally when adding packages.

---

## 3. Environment Variables

**Q: What is the difference between ARG and ENV in Dockerfile?**
> `ARG` is only available during the build process (`docker build`). Not available at runtime.
> `ENV` is available both during build and at runtime inside the container.

```dockerfile
ARG VITE_API_URL=/api/todos     # available only during build
ENV VITE_API_URL=$VITE_API_URL  # baked into image, available at runtime
```

---

**Q: Why can't you use `--env-file` for React/Vite frontend environment variables?**
> Vite bakes `VITE_*` variables into the JavaScript bundle at **build time**. The bundle is static HTML/JS/CSS. There is no process running at runtime to read environment variables. You must pass them during `docker build` via `ARG`, not `docker run` via `--env-file`.

```
Backend  → reads env at runtime  → --env-file works ✅
Frontend → baked at build time   → ARG/ENV in Dockerfile ✅
```

---

**Q: Why should secrets never be in a Docker image?**
> Images can be pushed to registries (Docker Hub, ECR), shared with teammates, and inspected with `docker history`. A secret baked into an image is permanently exposed. Always inject secrets at runtime via `--env-file` or orchestration tools (AWS Secrets Manager, Kubernetes secrets).

---

**Q: What happened when you put a comment inline in `.env`?**
> `.env` files don't support inline comments. Everything after `=` is the value.
> `DB_HOST=host.docker.internal ## comment` → hostname becomes `host.docker.internal ## comment` → DNS lookup fails.
> Full-line comments with `#` at the start of the line are fine.

---

## 4. Networking

**Q: Why can't a container use `localhost` to reach the host machine?**
> Inside a container, `localhost` (`127.0.0.1`) refers to the container's own network interface — not the host machine. Your host's services are not at `127.0.0.1` from inside a container.

```
Container tries localhost:5432  →  empty, no Postgres here  ❌
host.docker.internal:5432       →  your machine's Postgres  ✅
```

---

**Q: What is `host.docker.internal`?**
> A special hostname provided by Docker Desktop (Windows/Mac) that always resolves to the host machine's IP from inside a container. On Linux servers, you add `--add-host=host.docker.internal:host-gateway` to the `docker run` command manually.

---

**Q: What is a Docker network and why do containers need one?**
> By default, containers are isolated — they cannot reach each other by name. A custom Docker network gives containers a shared DNS space where container names become hostnames. Without a shared network, `proxy_pass http://server:5000` in nginx would fail with DNS resolution error.

---

**Q: How does Docker's internal DNS work?**
> When containers join the same custom network, Docker's embedded DNS server automatically resolves container names to their internal IP addresses. `--name server` becomes a resolvable hostname `server` for any other container on the same network.

---

**Q: What is the difference between `-p 5000:5000` and not exposing a port?**
> `-p HOST:CONTAINER` maps a port from the container to your machine — making it reachable from outside Docker.
> Without `-p`, the port is only reachable by other containers on the same network.
> In production, only nginx (port 80/443) should have `-p`. The backend port 5000 should NOT be exposed — traffic should only come through nginx.

---

## 5. Docker Compose

**Q: What is Docker Compose and why use it?**
> Docker Compose lets you define and run multi-container applications in a single YAML file. Instead of running 5 separate `docker` commands, you run `docker compose up`. It handles networking, build order, environment variables, and volumes automatically.

---

**Q: What is `depends_on` in Docker Compose?**
> `depends_on` controls startup order — a service won't start until its dependencies start. But by default it only waits for the container to start, not for the service inside to be ready. To wait for actual readiness (e.g., Postgres accepting connections), use `condition: service_healthy` combined with a `healthcheck`.

---

**Q: What is a healthcheck?**
> A command Docker runs periodically inside a container to determine if the service is healthy. Until the healthcheck passes, the container status is `starting` — dependent services wait. For Postgres: `pg_isready -U postgres` checks if it accepts connections.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

---

**Q: What is the difference between `image:` and `build:` in Docker Compose?**
> `image:` pulls a pre-built image from Docker Hub — used for official software like Postgres, Redis, nginx.
> `build:` builds an image from your Dockerfile — used for your own application code.

---

**Q: What is `env_file` vs `environment` in Docker Compose?**
> `env_file` loads all variables from a file (like `--env-file` in docker run).
> `environment` sets individual variables inline and **overrides** anything from `env_file`.
> This is how `DB_HOST: db` overrides `DB_HOST=host.docker.internal` from the `.env` file when using Compose.

---

**Q: What does `docker compose down -v` do vs `docker compose down`?**
> `docker compose down` stops and removes containers and networks.
> `docker compose down -v` also removes named volumes — permanently deletes all database data.
> Never run `-v` in production unless you intend to wipe the database.

---

**Q: How does the database host change across environments?**
> Only the `DB_HOST` env var changes. The app code never changes.

```
Local (no Docker)     → DB_HOST=localhost
Docker Compose        → DB_HOST=db  (postgres service name)
AWS EC2 + RDS         → DB_HOST=xxx.rds.amazonaws.com
```

---

## 6. nginx

**Q: Why use nginx to serve the React frontend instead of Node.js?**
> nginx is a production-grade web server written in C — handles thousands of concurrent connections, serves static files directly from memory, has built-in gzip, caching, and proxying. Node.js (`vite preview`) is a single-threaded dev server not designed for production. nginx image is also ~40MB vs ~180MB for Node.js.

---

**Q: What is `proxy_pass` in nginx?**
> Forwards incoming requests to another server. When nginx receives `GET /api/todos`, `proxy_pass http://server:5000` sends that request to the Express container and returns the response to the browser. The browser never talks to Express directly.

---

**Q: What is `try_files $uri $uri/ /index.html` in nginx?**
> SPA (Single Page Application) routing. When a user navigates to `/todos/123`, nginx looks for a file called `todos/123` — it doesn't exist. Without this rule, nginx returns 404. With this rule, nginx serves `index.html` as fallback and React Router handles the route client-side.

---

**Q: What CORS problem does nginx proxy_pass solve?**
> Without proxy, the browser calls `localhost:80` (frontend) and `localhost:5000` (backend) — two different origins → browser blocks the request (CORS). With nginx proxy, everything goes through `localhost:80` — one origin — CORS is never triggered.

---

## 7. Volumes

**Q: What is a Docker volume and why is it needed for Postgres?**
> Containers are stateless — all data inside is lost when the container is removed. A Docker volume mounts persistent storage that survives container restarts and removals. Without a volume, every `docker compose down` wipes your entire database.

---

**Q: What is the difference between a named volume and a bind mount?**
> Named volume: `postgres_data:/var/lib/postgresql/data` — Docker manages the storage location. Portable, works the same on any OS.
> Bind mount: `./data:/var/lib/postgresql/data` — maps a specific folder on your machine. Useful for development (edit files locally and see changes in container).

---

## 8. Scenario-Based Questions

**Q: Your container starts but exits immediately with exit code 1. How do you debug?**
> 1. `docker logs <container-name>` — read the error message
> 2. Common causes: missing env var, wrong CMD, port already in use, app crash on startup
> 3. Check if you passed a command after the image name by mistake (`docker run image command` — command overrides CMD)

---

**Q: Your React app shows "Unexpected token '<' is not valid JSON". What's wrong?**
> The API call returned HTML instead of JSON. Causes:
> 1. `VITE_API_URL` is `undefined` — the `.env` was excluded from Docker build context. Fix: use `ARG`/`ENV` in Dockerfile.
> 2. nginx proxy_pass is not routing `/api` to the backend — containers not on the same network, or server container name doesn't match.

---

**Q: Server container can't connect to Postgres — ECONNREFUSED 127.0.0.1:5432. Why?**
> `DB_HOST=localhost` inside the container means the container's own localhost — not the host machine. Fix:
> - Docker Compose with `db` service → `DB_HOST=db`
> - Manual docker run with host Postgres → `DB_HOST=host.docker.internal`

---

**Q: Your `npm ci` fails during docker build with "missing from lock file". Why?**
> `package.json` has packages that aren't in `package-lock.json` — someone added packages manually without running `npm install`. Fix: run `npm install` locally to regenerate the lockfile and commit it. `npm ci` requires lockfile to be in sync.

---

**Q: How would you move this app from Docker on local to Docker on AWS EC2?**
> 1. Push images to a registry (Docker Hub or AWS ECR)
> 2. SSH into EC2, pull images
> 3. Create production `.env` with `DB_HOST` pointing to RDS endpoint
> 4. Run with `docker compose up -d` using a production compose file (no `db` service — RDS handles it)
> 5. Configure security groups: only port 80/443 open publicly, port 5000 closed

---

## 9. Mistakes You Made & Why

| Mistake | What happened | Lesson |
|---|---|---|
| `docker run ... image image` | Second image name was treated as a COMMAND override — container exited code 1 immediately | Syntax: `docker run [flags] IMAGE [COMMAND]` — anything after image name replaces CMD |
| No `.dockerignore` | `node_modules` shipped to build daemon, overwriting clean `npm ci` install | Always create `.dockerignore` first |
| `DB_HOST=localhost` in container | Container's localhost has no Postgres | Use `host.docker.internal` for host machine, `db` for compose service |
| Inline comment in `.env` | `DB_HOST=host.docker.internal ## comment` — comment became part of hostname | `.env` has no inline comments — full-line `#` only |
| `.env` excluded by `.dockerignore` for client | `VITE_API_URL` was `undefined` at build time — fetched `"undefined"` URL | Frontend vars baked at build time — pass via `ARG`/`ENV` in Dockerfile |
| `package-lock.json` out of sync | `npm ci` failed — packages in `package.json` missing from lockfile | Always run `npm install` after adding packages and commit the lockfile |

---

## 10. Quick Revision Table

| Concept | One line |
|---|---|
| Image | Snapshot of app + OS + deps. Built once, run anywhere. |
| Container | Running instance of an image. |
| Layer | Each Dockerfile instruction = one cached layer. |
| `.dockerignore` | Excludes files from build context. Always exclude `node_modules` and `.env`. |
| Multi-stage build | Multiple FROM stages — builder installs, final image only runs. Smaller + cleaner. |
| `CMD` exec form | `["node", "index.js"]` — node is PID 1, receives SIGTERM for graceful shutdown. |
| `ARG` | Build-time variable. Available during `docker build` only. |
| `ENV` | Runtime variable. Baked into image. Available inside running container. |
| `--env-file` | Injects env vars at `docker run` time. Never bake secrets into image. |
| `host.docker.internal` | Special hostname to reach host machine from inside a container. |
| Docker network | Shared DNS space — container `--name` becomes a resolvable hostname. |
| `proxy_pass` | nginx forwards requests to another server (e.g., Express container). |
| `try_files ... /index.html` | SPA fallback — unknown paths serve index.html for React Router. |
| `depends_on` + `healthcheck` | Wait for service to be ready, not just started. |
| Named volume | Persistent storage managed by Docker. Survives container removal. |
| `docker compose down -v` | Removes containers AND volumes — wipes database. Never in production. |
| `image:` vs `build:` | `image:` = pull from Hub (Postgres, Redis). `build:` = your own Dockerfile. |
| `env_file` vs `environment` | `env_file` loads a file. `environment` sets inline and overrides `env_file`. |
