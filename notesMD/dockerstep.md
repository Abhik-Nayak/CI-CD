# Key Commands (memorize for DevOps)

### Images
```powershell
docker build -t name:tag .        # build image from Dockerfile
docker images                     # list images
docker rmi name:tag               # delete image
docker tag name:tag user/repo:tag # retag (before push)
docker push user/repo:tag         # push to registry
docker pull image:tag             # pull from registry
```

### Containers
```powershell
docker run -d --name x -p 80:80 image   # run detached, named, port-mapped
docker ps                               # running containers
docker ps -a                            # all (incl. stopped)
docker stop x / docker start x          # graceful stop / start
docker restart x
docker rm -f x                          # force remove
```

### Debug (most-used in real work)
```powershell
docker logs -f x                  # follow logs  ← #1 debugging tool
docker logs --tail 100 x          # last 100 lines
docker exec -it x sh              # shell inside container  ← #2
docker inspect x                  # full config: IP, env, mounts
docker stats                      # live CPU/mem
```

### Compose
```powershell
docker compose up -d --build      # build + start all
docker compose down               # stop + remove
docker compose down -v            # also delete volumes
docker compose logs -f svc        # logs for one service
docker compose ps
docker compose restart svc
```

### Network & Volumes
```powershell
docker network ls / inspect / create / rm
docker volume ls / inspect / create / rm
```

### Cleanup (frees disk)
```powershell
docker system prune -a            # remove unused images/containers/networks
docker volume prune               # remove unused volumes
```

### The 5 you'll type 100×/day
`docker ps` · `docker logs -f` · `docker exec -it x sh` · `docker compose up -d --build` · `docker compose down`

---

# Manual Docker Run (No Compose) — Microservices

**Prereqs:** Docker Desktop running, you're in `C:\GitProjects\CI-CD`, and each service's `.env` points at the **Aurora PostgreSQL cluster** (`DB_HOST`, `DB_SSL=true`). There is **no local Postgres and no DB container** — both services connect to the shared Aurora cluster.

**Architecture (4 containers):**

```
Browser :80
  └─ client (nginx)        serves React SPA, forwards /api → gateway
       └─ gateway (nginx)  routes by path prefix:
            ├─ /api/auth  → auth-service:5002   ┐ both use the SAME
            └─ /api/todos → todo-service:5001   ┘ Aurora database (devdb)
```

Both services connect to a **single shared database** (`devdb`) on the Aurora cluster — auth-service owns the `users` table, todo-service owns the `todos` table. Only **client** is published to the host (port 80); gateway, auth-service, todo-service are internal-only.

## 1. Create the network

```powershell
docker network create todo-network
```

## 2. Build the four images

```powershell
docker build -t auth-service ./services/auth-service
docker build -t todo-service ./services/todo-service
docker build -t gateway ./services/gateway
docker build -t client ./client
```

## 3. Run the containers (services first, client last)

```powershell
docker run -d --name auth-service --network todo-network --env-file ./services/auth-service/.env auth-service

docker run -d --name todo-service --network todo-network --env-file ./services/todo-service/.env todo-service

docker run -d --name gateway --network todo-network gateway

docker run -d --name client --network todo-network -p 80:80 client
```

Open **http://localhost**

## 4. Check

```powershell
docker logs -f client
# internal reachability (nginx:alpine has wget, not curl):
docker exec gateway wget -qO- http://auth-service:5002/api/health
docker exec gateway wget -qO- http://todo-service:5001/api/health
# end-to-end through the front door:
curl http://localhost/api/health
```

## Why the flags

- `--name X` → sets the container's **DNS name**. `gateway/nginx.conf` calls `http://auth-service:5002` and `http://todo-service:5001`, and `client/nginx.conf` calls `http://gateway`, so the names must match exactly.
- `--network todo-network` (all containers) → default bridge has no DNS; a user-defined network lets containers resolve each other by name.
- `--env-file ./services/<svc>/.env` → `docker run` does NOT auto-load `.env` (compose did). Without it: `Missing required environment variables`. `DB_HOST` inside points at Aurora, so **no** `host.docker.internal` override is needed.
- `-p 80:80` → only the client is host-exposed; the rest stay internal.

## Volumes

**Not needed in this project.** All data lives in the **Aurora cluster** (outside Docker), so every container is stateless. Add a named volume only if you later run a **Postgres container** (`-v pg_data:/var/lib/postgresql/data`) or store uploads inside a container.

## Cleanup

```powershell
docker rm -f client gateway todo-service auth-service
docker network rm todo-network
```

---

# Docker Compose (the easy way)

Compose does all the manual steps above (build, network, run, env) from one file. Services connect to the **Aurora cluster** via each service's `env_file` — no DB container, no volumes.

```powershell
# dev — build + start everything in background
docker compose up -d --build

# prod
docker compose -f docker-compose.prod.yml up -d --build

# Follow logs
docker compose logs -f                # all services
docker compose logs -f auth-service   # one service

# Status
docker compose ps

# Stop + remove containers and network
docker compose down
```

**Compose vs manual:**

| Manual | Compose |
|--------|---------|
| `docker build` ×4 | `--build` |
| `docker network create` | auto-created |
| `docker run` ×4 with flags | defined in YAML |
| pass `--env-file` by hand | `env_file` in YAML |
| set `--name` for DNS | service name = DNS name |

> Network and naming are automatic in compose, so nginx resolves `auth-service` / `todo-service` / `gateway` without manual `--name` and `--network`.
