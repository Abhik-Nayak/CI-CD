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

# Manual Docker Run (No Compose) — Local Postgres

**Prereqs:** Docker Desktop running, local Postgres on `5432` with `todos` DB, you're in `C:\GitProjects\CI-CD`.

## Server

```powershell
# 1. Build image
docker build -t todo-server ./server

# 2. Run container
docker run -d --name server -p 5000:5000 --env-file ./server/.env -e DB_HOST=host.docker.internal todo-server

# 3. Check
docker logs -f server
curl http://localhost:5000/api/health
```

## Client (full stack)

```powershell
# 4. Create network
docker network create todo-net

# 5. Add server to it
docker network connect todo-net server

# 6. Build client
docker build -t todo-client ./client

# 7. Run client on same network
docker run -d --name client --network todo-net -p 80:80 -p 8080:8080 todo-client
```

Open **http://localhost**

## Why the overrides

- `--env-file ./server/.env` → `docker run` does NOT auto-load `.env` (compose did). Without it: `Missing required environment variables`.
- `-e DB_HOST=host.docker.internal` → inside a container `localhost` = the container, not your PC. This reaches host Postgres.
- `--network todo-net` (both containers) → nginx needs to resolve `server` (`proxy_pass http://server:5000`). Default bridge has no DNS.

## Volumes

**Why needed:** A container's filesystem is temporary — `docker rm` deletes everything inside it. A volume stores data *outside* the container so it survives restarts, rebuilds, and removal.

**When needed:** Only when something *inside* a container holds data you must keep — e.g. a **Postgres container** (`-v pg_data:/var/lib/postgresql/data`), uploaded files, etc. A volume is created only if you ask for one (`-v name:/path` or compose `volumes:`).

**In this project: NOT needed.** Your data lives in your **local host Postgres** (outside Docker). The `server` and `client` containers are stateless. So no volume — host Postgres handles persistence.

> If you later switch to a **db container**, then add a named volume so the data survives `docker rm`.

## Cleanup

```powershell
docker rm -f server client
docker network rm todo-net
```

---

# Docker Compose (the easy way)

Compose does all the manual steps above (build, network, run, env) from one file: `docker-compose.yml`. It also uses your **local host Postgres** (`DB_HOST: host.docker.internal`, no db container).

```powershell
# Build + start everything in background
docker compose up -d --build

# Follow logs
docker compose logs -f          # all services
docker compose logs -f server   # one service

# Status
docker compose ps

# Stop + remove containers and network
docker compose down
```

**Compose vs manual:**

| Manual | Compose |
|--------|---------|
| `docker build` ×2 | `--build` |
| `docker network create` + `connect` | auto-created |
| `docker run` ×2 with flags | defined in YAML |
| pass `--env-file`, `-e DB_HOST` by hand | `env_file` + `environment` in YAML |

> Network and naming are automatic in compose, so nginx resolves `server` without manual `network connect`.
