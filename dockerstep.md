# Docker Notes — Client, Server, Network & nginx

---

## Table of Contents

1. [What is Docker?](#1-what-is-docker)
2. [Files You Need](#2-files-you-need)
3. [Dockerfile Explained](#3-dockerfile-explained)
4. [docker build — Command Breakdown](#4-docker-build--command-breakdown)
5. [docker run — Command Breakdown](#5-docker-run--command-breakdown)
6. [Errors You Hit & Why](#6-errors-you-hit--why)
7. [Docker Networking](#7-docker-networking)
8. [Common Commands Cheat Sheet](#8-common-commands-cheat-sheet)
9. [PM2 vs Docker](#9-pm2-vs-docker)
10. [Why nginx for Frontend](#10-why-nginx-for-frontend)
11. [Server Dockerfile — Full Explanation](#11-server-dockerfile--full-explanation)
12. [Client Dockerfile — Full Explanation](#12-client-dockerfile--full-explanation)
13. [Docker Network — Client & Server Together](#13-docker-network--client--server-together)
14. [Complete Step-by-Step Run Guide](#14-complete-step-by-step-run-guide)

---

## 1. What is Docker?

Docker packages your app and everything it needs (Node.js, dependencies, config) into a single unit called an **image**. You can run that image on any machine and it behaves identically — your laptop, a colleague's machine, or an EC2 server.

```
Without Docker                     With Docker
──────────────────────────         ──────────────────────────
"Works on my machine"              Works on every machine

You need to:                       You just run:
- Install Node.js                  docker run todo-server
- Install correct npm version
- Set up Postgres
- Set env variables
- Hope versions match
```

### Key terms

| Term | Meaning |
|---|---|
| **Image** | A snapshot of your app + OS + dependencies. Built once, run anywhere. |
| **Container** | A running instance of an image. Like a process spawned from the image. |
| **Dockerfile** | A recipe that tells Docker how to build the image. |
| `.dockerignore` | Like `.gitignore` — files Docker should NOT copy into the image. |
| **Build context** | The folder Docker reads when building. Everything not in `.dockerignore` gets sent. |
| **Layer** | Each instruction in a Dockerfile creates a cached layer. Docker reuses unchanged layers. |

---

## 2. Files You Need

```
server/
├── Dockerfile          ← Recipe to build the image
├── .dockerignore       ← What to exclude from the image
├── .env                ← Secrets — NEVER baked into image, injected at runtime
├── index.js
├── package.json
└── package-lock.json   ← MUST be committed — npm ci depends on it
```

### `.dockerignore` (critical — don't skip)

```
node_modules    ← Never copy host node_modules into image
.env            ← Never bake secrets into image
.env.*
*.log
.git
```

**Why `node_modules` must be ignored:**
Without `.dockerignore`, `COPY . .` ships all 50,000+ node_modules files to the Docker daemon. This:
- Slows the build by 10x
- Overwrites the clean `npm ci` install Docker just made
- Can corrupt the production install with devDependencies

---

## 3. Dockerfile Explained

```dockerfile
# ── Stage 1: Install dependencies ──────────────────────
FROM node:22-alpine AS deps
```
`FROM` sets the base image. `node:22-alpine` = Node 22 on Alpine Linux.
Alpine is a minimal Linux distro (~5MB). Full Debian image = ~1GB. Always use Alpine for production.
`AS deps` names this stage so Stage 2 can copy from it.

```dockerfile
WORKDIR /app
```
All commands below run from `/app` inside the container. Creates the folder if it doesn't exist.

```dockerfile
COPY package*.json ./
```
Copy `package.json` AND `package-lock.json` before anything else.
**Why?** Docker caches each layer. If only source code changes, this layer is already cached — `npm ci` doesn't re-run. If you copy everything at once, any code change would bust the cache and re-install all packages.

```
Code change → only COPY . . layer re-runs      ✅ Fast
Code change → COPY . . before npm ci           ❌ Full reinstall every time
```

```dockerfile
RUN npm ci --omit=dev
```
`npm ci` = strict reproducible install from `package-lock.json`. Never guesses versions.
`--omit=dev` = skip `nodemon`, `eslint`, and other devDependencies. Not needed in production.
**Important:** `npm ci` FAILS if `package-lock.json` is out of sync with `package.json`. Always run `npm install` locally and commit the lockfile.

```dockerfile
# ── Stage 2: Production image ───────────────────────────
FROM node:22-alpine
WORKDIR /app
USER node
```
Start a fresh minimal image. `USER node` switches to a non-root user.
**Why non-root?** If an attacker exploits your Express app, they get a restricted user — not root access to the host machine. One line, big security win.

```dockerfile
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
```
`--from=deps` copies the production `node_modules` from Stage 1.
`--chown=node:node` makes the `node` user own the files (required since we switched to USER node).
Source code is copied last — unchanged dependencies are cached.

```dockerfile
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "index.js"]
```
`EXPOSE` is documentation only — it doesn't open the port. Actual mapping happens at `docker run -p`.
`NODE_ENV=production` enables Express production optimisations.
`CMD` in exec form `["node", "..."]` makes node PID 1 — it receives OS signals (SIGTERM) directly, so `docker stop` does a graceful shutdown instead of a hard kill.

---

## 4. docker build — Command Breakdown

```powershell
docker build -t todo-server ./server
```

| Part | What it does |
|---|---|
| `docker build` | Read a Dockerfile and create an image |
| `-t todo-server` | Tag (name) the image as `todo-server`. Without `-t` you'd reference it by hash. |
| `./server` | The build context — the folder Docker reads. Dockerfile must be inside here. |

### What happens during build

```
docker build ./server
      │
      ▼
Docker reads server/Dockerfile
      │
      ▼
Docker sends server/ folder to Docker daemon
(this is why .dockerignore matters — node_modules would make this huge)
      │
      ▼
Executes each instruction → creates a layer
      │
      ▼
Stores final image locally as "todo-server"
```

---

## 5. docker run — Command Breakdown

```powershell
docker run -d -p 5000:5000 --env-file ./server/.env --name todo-server todo-server
```

| Flag | Full form | What it does |
|---|---|---|
| `-d` | `--detach` | Run in background. Returns container ID and frees your terminal. Without this, the terminal is captured by container logs. |
| `-p 5000:5000` | `--publish` | Map port. Format is `HOST_PORT:CONTAINER_PORT`. Traffic hitting your machine on 5000 is forwarded into the container on 5000. |
| `--env-file ./server/.env` | — | Inject environment variables from a file at runtime. The image stays clean — no secrets baked in. |
| `--name todo-server` | — | Give the container a human-readable name. Without this, Docker assigns a random name like `quirky_einstein`. Needed to run `docker stop todo-server`. |
| `todo-server` (last) | — | The image name to create a container from. This is what you named it with `-t` during build. |

### Port mapping visualised

```
Your Windows machine            Container
┌───────────────────┐           ┌───────────────────┐
│                   │           │                   │
│  Browser hits     │           │  Express listens  │
│  localhost:5000   │──────────►│  on port 5000     │
│                   │  -p 5000:5000                 │
└───────────────────┘           └───────────────────┘
   HOST port                       CONTAINER port
```

You can use different ports: `-p 8080:5000` means your machine's 8080 maps to container's 5000.

---

## 6. Errors You Hit & Why

### Error 1 — npm ci lockfile out of sync

```
npm error Missing: compression@1.8.1 from lock file
npm error Missing: express-rate-limit@8.5.2 from lock file
```

**Cause:** Packages were added to `package.json` manually but `npm install` was never run — so `package-lock.json` didn't know about them.

**Fix:** Run `npm install` locally, commit the updated `package-lock.json`, then rebuild.

**Rule:** Always commit `package-lock.json`. CI/CD pipelines use `npm ci` which reads only the lockfile.

---

### Error 2 — ECONNREFUSED localhost:5432

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause:** Inside a container, `localhost` = the container itself. Your Postgres is on your Windows machine. The container can't reach it via `127.0.0.1`.

**Fix:** Use `host.docker.internal` in `.env` — a special hostname Docker Desktop provides that always resolves to the host machine.

```
DB_HOST=host.docker.internal
```

---

### Error 3 — Inline comment treated as value

```
hostname: 'host.docker.internal ## for docker container creation'
```

**Cause:** `.env` files don't support inline comments. Everything after `=` is the value, including `##`.

```bash
DB_HOST=host.docker.internal ## comment   ← WRONG: comment becomes part of hostname
# This is a comment                        ← CORRECT: full-line comment
DB_HOST=host.docker.internal               ← CORRECT: no inline comment
```

---

### Error 4 — Terminal captured by container

**Cause:** `docker run` without `-d` attaches your terminal to the container's stdout. `Ctrl+C` stops the container.

**Fix:** Always use `-d` for servers.

---

## 7. Docker Networking

### Why `localhost` doesn't work inside containers

```
Your Windows machine
├── Postgres: localhost:5432       ← 127.0.0.1 on the HOST
└── Docker container
    └── Express app
        └── tries localhost:5432   ← 127.0.0.1 INSIDE the container (empty)
```

### The 3 contexts you'll hit

| Where your app runs | How to reach host Postgres |
|---|---|
| Directly on your machine | `localhost` |
| Inside a Docker container | `host.docker.internal` |
| Docker Compose (Postgres also containerized) | service name e.g. `db` |

### Note for Linux servers (EC2)

`host.docker.internal` is automatic on Docker Desktop (Windows/Mac). On Linux EC2, add this flag:

```bash
docker run --add-host=host.docker.internal:host-gateway ...
```

---

## 8. Common Commands Cheat Sheet

### Build

```powershell
docker build -t todo-server ./server              # Build image, tag it as todo-server
docker build -t todo-server:v2 ./server           # Build with a version tag
docker build --no-cache -t todo-server ./server   # Force full rebuild, skip all cached layers
docker images                                     # List all images on your machine
docker rmi todo-server                            # Delete an image
docker rmi todo-server:v2                         # Delete a specific tagged image
```

---

### Create & Run

```powershell
# ✅ WORKING — correct command for this project
docker run -d -p 5000:5000 --env-file ./server/.env --name todo-server todo-server

# ❌ NOT WORKING — extra "todo-server" at the end overrides CMD in Dockerfile
docker run -d -p 5000:5000 --env-file ./server/.env todo-server todo-server
```

**Why the broken one fails:**
Docker syntax is `docker run [flags] IMAGE [COMMAND]`.
Anything after the image name replaces the `CMD` defined in the Dockerfile.
So the second `todo-server` tells Docker to run a binary called `todo-server` instead of `node index.js` — that binary doesn't exist → container exits with code 1 immediately.

```powershell
# Flags you'll use most:
# -d                       → detached (background), frees your terminal
# -p HOST:CONTAINER        → port mapping, e.g. -p 8080:5000
# --env-file <path>        → inject .env file at runtime
# --name <name>            → readable name instead of random (e.g. magical_booth)
# --restart unless-stopped → auto-restart on crash or reboot (use on EC2)

docker run -d -p 5000:5000 --env-file ./server/.env --name todo-server --restart unless-stopped todo-server
```

---

### Inspect & Status

```powershell
docker ps                        # Show running containers (ID, name, ports, status)
docker ps -a                     # Show ALL containers including stopped ones
docker inspect todo-server       # Full JSON details: IP, mounts, env vars, config
docker stats                     # Live CPU, memory, network usage for all containers
docker stats todo-server         # Live stats for one container
docker top todo-server           # Processes running inside the container
docker port todo-server          # Show port mappings for a container
```

---

### Logs

```powershell
docker logs todo-server               # Print all logs since container started
docker logs -f todo-server            # Follow logs live (Ctrl+C to stop following)
docker logs --tail 50 todo-server     # Show only last 50 lines
docker logs --tail 50 -f todo-server  # Last 50 lines then follow live
docker logs -t todo-server            # Show logs with timestamps
```

---

### Stop & Start

```powershell
docker stop todo-server          # Graceful stop — sends SIGTERM, waits 10s, then SIGKILL
docker start todo-server         # Start a stopped container (keeps same config)
docker restart todo-server       # Stop + start in one command
docker kill todo-server          # Force kill immediately — sends SIGKILL, no wait
```

`stop` vs `kill`:
- `stop` = polite. Gives the app time to close DB connections, finish requests.
- `kill` = force. Use only if `stop` hangs.

---

### Remove (Terminate)

```powershell
docker rm todo-server                            # Remove a stopped container
docker rm -f todo-server                         # Force remove even if running (stop + remove)
docker stop todo-server && docker rm todo-server # Clean stop then remove

# Remove everything unused (safe cleanup)
docker container prune                           # Remove all stopped containers
docker image prune                               # Remove dangling (untagged) images
docker system prune                              # Remove stopped containers + dangling images + unused networks
docker system prune -a                           # Also remove images not used by any container
```

---

### Debug (get inside a running container)

```powershell
docker exec -it todo-server sh         # Open shell inside the container (Alpine uses sh not bash)
docker exec -it todo-server env        # Print all environment variables the container sees
docker exec -it todo-server ls /app    # Run any command without opening a full shell
docker cp todo-server:/app/index.js .  # Copy a file out of the container to your machine
```

`-it` = interactive terminal. Required whenever you need input (like a shell).

---

### Quick Reference Card

| Task | Command |
|---|---|
| Build image | `docker build -t <name> <path>` |
| Run container | `docker run -d -p HOST:CONT --env-file .env --name <name> <image>` |
| See running | `docker ps` |
| See logs | `docker logs -f <name>` |
| Stop | `docker stop <name>` |
| Force stop | `docker kill <name>` |
| Remove container | `docker rm <name>` |
| Remove image | `docker rmi <name>` |
| Shell inside | `docker exec -it <name> sh` |
| Live stats | `docker stats <name>` |
| Full cleanup | `docker system prune -a` |

---

## 9. PM2 vs Docker

You've now used both. Here's when to use which:

| | PM2 | Docker |
|---|---|---|
| **What it manages** | Node.js process | Full OS + app environment |
| **Isolation** | None — shares host OS | Full — own filesystem, network |
| **Portability** | Only on same OS/Node version | Runs identically anywhere |
| **Startup** | `pm2 start ecosystem.config.js` | `docker run ...` |
| **Auto-restart** | Yes (on crash) | Yes (with `--restart` policy) |
| **Best for** | EC2 without Docker, simple deploys | Consistent environments, teams, scaling |
| **Env vars** | `.env` file or `env` in ecosystem.config.js | `--env-file` at runtime, never in image |

### Current stack

```
Local development
└── node index.js (direct) OR docker run (containerized)

EC2 Production (current)
└── PM2 → node index.js
    └── ecosystem.config.js defines the process

EC2 Production (next step with Docker)
└── docker run / docker-compose
    └── Dockerfile defines the environment
```

The next step from here is **Docker Compose** — running Postgres and the backend together as a group of containers, so you don't need Postgres installed on the host at all.

---

## 10. Why nginx for Frontend

When you containerize a React app, you have two options to serve it:

| | Node.js (`vite preview`) | nginx |
|---|---|---|
| **Purpose** | Development preview server | Production-grade web server |
| **Performance** | Single-threaded JS | Written in C, handles thousands of concurrent connections |
| **Static files** | Slow — reads file every request | Fast — serves directly from memory with OS caching |
| **Gzip compression** | Manual setup | Built-in |
| **API proxying** | Not built-in | Built-in (`proxy_pass`) |
| **Image size** | ~180MB (node:alpine) | ~40MB (nginx:alpine) |
| **Used in production** | Never | Always |

### What nginx does in this project

```
Browser → http://localhost:80
               │
               ▼
         [nginx container]
               │
               ├── GET /                → serves index.html from /usr/share/nginx/html
               ├── GET /index-abc.js    → serves JS bundle (static file)
               ├── GET /index-abc.css   → serves CSS (static file)
               │
               └── GET /api/todos       → proxy_pass → [server container]:5000
                                                              │
                                                              ▼
                                                        Express handles it
                                                              │
                                                              ▼
                                                         PostgreSQL
```

### Why proxy_pass matters

Without nginx proxying, the browser would call `http://localhost:5000/api/todos` directly.
With nginx proxying, the browser calls `http://localhost/api/todos` — nginx forwards it internally.

Benefits:
- **No CORS** — browser sees one origin (`localhost:80`), not two (`localhost:80` + `localhost:5000`)
- **Backend not exposed** — port 5000 is not open to the internet on production
- **One entry point** — all traffic goes through nginx

---

## 11. Server Dockerfile — Full Explanation

```
server/
├── Dockerfile
├── .dockerignore     ← excludes node_modules, .env, logs
├── index.js          ← Express app — pure API, no static file serving
├── db.js             ← PostgreSQL pool — validates env vars on startup
├── routes/todos.js   ← CRUD routes
└── package.json      ← dependencies: express, pg, dotenv, cors, helmet, compression
```

### Dockerfile (2-stage)

**Stage 1 — `deps`:** Install only production dependencies using `npm ci --omit=dev`.
Nodemon is excluded. `npm ci` requires `package-lock.json` to be committed and in sync.

**Stage 2 — production image:** Copy only `node_modules` from Stage 1 + source code.
Runs as `USER node` (non-root). `CMD ["node", "index.js"]` makes node PID 1 for clean signal handling.

### Key facts about the server code

- `dotenv` loads `.env` at startup — in Docker, env vars come from `--env-file` instead
- `db.js` throws on startup if any of `DB_USER DB_PASS DB_HOST DB_PORT DB_NAME` are missing
- `DB_HOST=host.docker.internal` — special hostname to reach your machine's Postgres from inside a container
- Static file serving is **commented out** — nginx handles the frontend, Express is API-only
- Table `todos` is auto-created on first startup via `CREATE TABLE IF NOT EXISTS`

### Run command

```powershell
docker run -d -p 5000:5000 --env-file ./server/.env --name server --network todo-network todo-server
```

`--name server` must match exactly — nginx uses `http://server:5000` in proxy_pass.

---

## 12. Client Dockerfile — Full Explanation

```
client/
├── Dockerfile
├── .dockerignore     ← excludes node_modules, dist, .env
├── nginx.conf        ← SPA routing + API proxy config
├── src/App.jsx       ← reads VITE_API_URL which is /api/todos
└── package.json      ← react, vite (devDep), @vitejs/plugin-react
```

### Dockerfile (2-stage)

**Stage 1 — `builder`:** Full Node.js install (`npm ci` without `--omit=dev` — vite is a devDependency needed to build). Sets `VITE_API_URL` via `ARG`/`ENV` before running `npm run build`. Output goes to `/app/dist`.

**Stage 2 — nginx:** Copies `/app/dist` into `/usr/share/nginx/html`. Copies `nginx.conf` over the default nginx config. Final image is ~40MB with no Node.js at all.

### Why ARG + ENV for VITE_API_URL

```
❌ WRONG — .env excluded from build context by .dockerignore
   Result: VITE_API_URL = undefined → fetch("undefined") → HTML returned → JSON parse error

✅ CORRECT — passed as ARG in Dockerfile, set as ENV before build
   ARG VITE_API_URL=/api/todos
   ENV VITE_API_URL=$VITE_API_URL
   RUN npm run build
   Result: VITE_API_URL = "/api/todos" baked into bundle
```

Vite reads `VITE_*` variables from the process environment during build.
`ARG` makes it available at build time. `ENV` sets it in the process so Vite can read it.

### nginx.conf explained

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
React SPA routing — if the file doesn't exist on disk (e.g. `/todos/123`), serve `index.html` and let React Router handle it client-side.

```nginx
location /api {
    proxy_pass http://server:5000;
}
```
Any request starting with `/api` is forwarded to the `server` container on port 5000.
`server` is resolved by Docker's internal DNS — it maps to the container named `server`.

### Run command

```powershell
docker run -d -p 80:80 --name client --network todo-network todo-client
```

No `--env-file` needed — `VITE_API_URL` was already baked into the bundle during build.

---

## 13. Docker Network — Client & Server Together

### Why a custom network is needed

By default, containers are isolated — they cannot reach each other by name.
A custom network gives both containers a shared DNS space where container names become hostnames.

```
Without network:                   With todo-network:
─────────────────                  ─────────────────────────────
client → "server" → ??? FAIL       client → "server" → resolves to server container IP ✅
```

### How Docker DNS works

```
docker network create todo-network

docker run --name server --network todo-network ...
docker run --name client --network todo-network ...

Inside client container:
  curl http://server:5000/api/health   ← "server" resolves automatically
```

Docker runs an internal DNS server. When both containers are on the same network, their `--name` becomes a resolvable hostname. This is how `proxy_pass http://server:5000` in nginx.conf works.

### Network commands

```powershell
docker network create todo-network              # Create the network
docker network ls                               # List all networks
docker network inspect todo-network            # See which containers are connected + their IPs
docker network rm todo-network                 # Delete network (containers must be stopped first)
```

### Full architecture

```
                    ┌─────────────────────────────────────┐
                    │         todo-network (bridge)        │
                    │                                      │
Browser ───────────►│  [client]  nginx:80                  │
      port 80       │      │                               │
                    │      │ proxy_pass /api               │
                    │      ▼                               │
                    │  [server]  Express:5000              │
                    │      │                               │
                    └──────┼──────────────────────────────┘
                           │ host.docker.internal:5432
                           ▼
                    PostgreSQL (your machine)
```

Port 5000 is mapped with `-p 5000:5000` for direct testing only.
In production, you would remove `-p 5000:5000` — backend should only be reachable through nginx.

---

## 14. Complete Step-by-Step Run Guide

### First time setup

```powershell
# 1. Sync lockfile (required for npm ci to work)
cd server && npm install && cd ..

# 2. Build both images
docker build -t todo-server ./server
docker build -t todo-client ./client

# 3. Create shared network
docker network create todo-network

# 4. Run server (must start before client — nginx proxies to it)
docker run -d -p 5000:5000 --env-file ./server/.env --name server --network todo-network todo-server

# 5. Verify server started correctly
docker logs server
# Expected: "Database table ready" + "Server running on port 5000"

# 6. Run client
docker run -d -p 80:80 --name client --network todo-network todo-client

# 7. Verify both running
docker ps
# Expected: both "server" and "client" show Status = Up

# 8. Open browser
# http://localhost
```

### After any code change — rebuild only what changed

```powershell
# Server code changed:
docker rm -f server
docker build -t todo-server ./server
docker run -d -p 5000:5000 --env-file ./server/.env --name server --network todo-network todo-server

# Client code changed:
docker rm -f client
docker build -t todo-client ./client
docker run -d -p 80:80 --name client --network todo-network todo-client
```

### Full reset

```powershell
docker rm -f server client
docker network rm todo-network
```

### Errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `npm ci` fails — missing packages | `package-lock.json` out of sync | Run `npm install` in server/, commit lockfile |
| `ECONNREFUSED 127.0.0.1:5432` | Container can't reach host Postgres via localhost | Set `DB_HOST=host.docker.internal` in server/.env |
| `Unexpected token '<' is not valid JSON` | `VITE_API_URL` is undefined — .env excluded from build | Use `ARG`/`ENV` in Dockerfile to set it at build time |
| Container exits immediately (exit code 1) | Extra word after image name overrides CMD | Remove duplicate image name: `docker run ... todo-server` not `docker run ... todo-server todo-server` |
| Terminal captured | No `-d` flag | Always use `-d` for server containers |
| nginx can't reach `server:5000` | Containers on different networks | Both must use `--network todo-network` and server `--name` must be `server` |
