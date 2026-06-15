# Docker Commands Reference

---

## 1. CONTAINERS

### List
```bash
docker ps                    # running containers only
docker ps -a                 # all containers (including stopped)
docker ps -q                 # only container IDs (useful for scripting)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"  # clean table view
```
> **When:** First thing to run when something isn't working — see what's actually running and what crashed.

### Inspect / Logs
```bash
docker logs <name>           # all logs
docker logs <name> -f        # follow logs in real time (like tail -f)
docker logs <name> --tail 50 # last 50 lines only

docker inspect <name>        # full JSON dump — IP, mounts, env vars, everything
docker stats                 # live CPU/memory usage of all running containers
docker top <name>            # processes running inside a container
```
> **When:** App is running but behaving wrong. `logs` first, `inspect` if you need to verify env vars or network config.

### Start / Stop / Restart
```bash
docker start <name>          # start a stopped container
docker stop <name>           # graceful stop (SIGTERM → waits → SIGKILL)
docker kill <name>           # immediate stop (SIGKILL)
docker restart <name>        # stop + start
```
> **When:** `stop` for normal shutdown. `kill` only if container is frozen and `stop` hangs.

### Remove
```bash
docker rm <name>             # remove stopped container
docker rm -f <name>          # force remove even if running
docker rm $(docker ps -aq)   # remove ALL stopped containers
```
> **When:** After stopping a container you no longer need. Removes the container but NOT the image.

### Execute inside container
```bash
docker exec -it <name> sh    # open shell inside running container (alpine)
docker exec -it <name> bash  # open shell inside running container (ubuntu/debian)
docker exec -it <name> env   # print env vars inside container
```
> **When:** Debugging — check if files exist, env vars are correct, or test a DB connection from inside the container.

---

## 2. DOCKERFILE — Build & Run Manually

### Build image from Dockerfile
```bash
# Basic build — runs Dockerfile in current directory
docker build -t myapp .

# Specify Dockerfile path (if not in current dir)
docker build -t myapp -f ./client/Dockerfile .

# Build with a tag (name:version)
docker build -t myapp:1.0 .

# Force full rebuild — ignore all cached layers
docker build --no-cache -t myapp .

# Pass build argument (e.g. VITE_API_URL in client Dockerfile)
docker build --build-arg VITE_API_URL=http://localhost:5000 -t myapp .
```
> **When:** You want to build ONE image manually without docker compose.

### Run container from image
```bash
# Basic run
docker run myapp

# Run detached (background)
docker run -d myapp

# Run with port mapping (host:container)
docker run -d -p 80:80 myapp

# Run with name (easier to reference later)
docker run -d -p 80:80 --name my-client myapp

# Run and attach to network
docker run -d -p 80:80 --network todo-network --name my-client myapp

# Run with env variable
docker run -d -p 5000:5000 -e NODE_ENV=production myapp

# Run interactively (get a shell, no app start)
docker run -it myapp sh
```
> **When:** Testing one container in isolation before wiring it up with compose.

### Build + Run — This Project Manually
```bash
# Step 1 — create shared network
docker network create todo-network

# Step 2 — build images
docker build -t ci-cd-client ./client
docker build -t ci-cd-server ./server

# Step 3 — run containers on same network
docker run -d -p 80:80 --network todo-network --name ci-cd-client-1 ci-cd-client
docker run -d -p 5000:5000 --network todo-network --name ci-cd-server-1 ci-cd-server
```
> **What compose does:** All of the above steps in one command — `docker compose up --build`

---

## 3. IMAGES

### List
```bash
docker images                # all local images
docker images -a             # including intermediate build layers
docker images -q             # IDs only
```
> **When:** Check what images are cached locally before deciding to pull or rebuild.

### Pull / Build
```bash
docker pull postgres:16-alpine           # download image from Docker Hub
docker build -t myapp:latest .           # build from Dockerfile in current dir
docker build -t myapp:latest -f path/to/Dockerfile .  # specify Dockerfile path
docker build --no-cache -t myapp:latest .              # force full rebuild, ignore cache
```
> **When:** `--no-cache` when a build is pulling stale dependencies or a layer isn't refreshing as expected.

### Remove
```bash
docker rmi <image-id>        # remove specific image
docker rmi -f <image-id>     # force remove (even if container references it)
docker image prune           # remove dangling images (untagged, unused layers)
docker image prune -a        # remove ALL unused images (not just dangling)
```
> **When:** Disk getting full. `prune` is safe — only removes images with no running container using them.

### Inspect
```bash
docker inspect <image-id>    # full config — layers, env, entrypoint, exposed ports
docker history <image-id>    # shows each layer and what command created it + size
```
> **When:** Debugging a Dockerfile — `history` shows you exactly which layer is bloating the image size.

---

## 3. NETWORKS

### List
```bash
docker network ls            # all networks
```
Output columns: NETWORK ID, NAME, DRIVER, SCOPE
> Default networks: `bridge`, `host`, `none` — these are always present, ignore them.

### Inspect
```bash
docker network inspect <name>   # shows which containers are connected + their IPs
```
> **When:** Container A can't reach container B. Run this to confirm both are on the same network and get their internal IPs.

### Create / Remove
```bash
docker network create <name>                        # create a bridge network
docker network create --driver bridge <name>        # explicit bridge (same as above)
docker network rm <name>                            # remove a network
docker network prune                                # remove all unused networks
```

### Connect / Disconnect
```bash
docker network connect <network> <container>        # attach running container to a network
docker network disconnect <network> <container>     # detach
```
> **When:** You started a container without the right network and don't want to recreate it.

---

## 4. VOLUMES

### List
```bash
docker volume ls             # all volumes
docker volume ls -q          # IDs only
```

### Inspect
```bash
docker volume inspect <name>   # shows mount path on host, creation date, labels
```
> **When:** You want to find where Docker is actually storing the data on your host machine.

### Create / Remove
```bash
docker volume create <name>     # create a named volume manually
docker volume rm <name>         # remove a specific volume (must have no container using it)
docker volume prune             # remove ALL unused volumes
```
> **WARNING:** `volume prune` deletes your data permanently. For this project, running it removes all postgres data.

---

## 5. SYSTEM / CLEANUP

### Overview
```bash
docker system df             # disk usage — images, containers, volumes, build cache
docker system df -v          # verbose — shows each item and its size
```
> **When:** Disk space is running low. Run this first to see what's taking up space before pruning.

### Prune (targeted)
```bash
docker container prune       # remove all stopped containers
docker image prune           # remove dangling images only
docker image prune -a        # remove all unused images
docker volume prune          # remove all unused volumes
docker network prune         # remove all unused networks
```

### Prune (nuclear)
```bash
docker system prune          # containers + networks + dangling images
docker system prune -a       # + ALL unused images (not just dangling)
docker system prune -af      # same but no confirmation prompt
docker system prune -af --volumes   # everything including volumes (DELETES DATA)
```
> **When:** Starting completely fresh. `--volumes` flag is destructive — use only when you want to wipe all local DB data too.

---

## 6. DOCKER COMPOSE

### Start / Stop
```bash
docker compose up                  # start all services (attach — logs in terminal)
docker compose up -d               # start detached (background)
docker compose up --build          # rebuild images then start
docker compose up --build -d       # rebuild + detached
docker compose down                # stop and remove containers + networks
docker compose down -v             # + remove volumes (wipes DB data)
docker compose down --rmi all      # + remove built images
docker compose down --rmi all -v   # full clean — images + volumes
docker compose restart             # restart all services
docker compose restart server      # restart one specific service
```

### Logs
```bash
docker compose logs              # all services
docker compose logs -f           # follow all services
docker compose logs server       # one service only
docker compose logs -f server    # follow one service
docker compose logs --tail 50    # last 50 lines per service
```

### Status / Inspect
```bash
docker compose ps                # status of all compose services
docker compose config            # validate and print the resolved compose file
```

### Execute
```bash
docker compose exec server sh    # shell inside running server container
docker compose exec db psql -U postgres   # psql inside postgres container
```

### Build only (no start)
```bash
docker compose build             # build all images
docker compose build server      # build one service image
docker compose build --no-cache  # force full rebuild
```

---

## 7. QUICK REFERENCE — THIS PROJECT

```bash
# Fresh start (rebuild everything)
docker compose down --rmi all -v && docker compose up --build -d

# View server logs live
docker compose logs -f server

# Shell into server container
docker compose exec server sh

# Check what's running
docker compose ps

# Stop everything, keep data
docker compose down

# Check disk usage
docker system df
```

---

## 8. FLAGS REFERENCE

Flags are short options that modify a command. **The same letter can mean different things per command — context matters.**

### Common flags
| Flag | Long form | Means | Example |
|------|-----------|-------|---------|
| `-d` | `--detach` | run in background, frees terminal | `docker run -d`, `docker compose up -d` |
| `-t` | `--tag` | name/tag the image | `docker build -t myapp .` |
| `-f` | `--force` | force the action (skip safety checks) | `docker rm -f`, `docker rmi -f` |
| `-p` | `--publish` | port map `host:container` | `docker run -p 5000:5000` |
| `-e` | `--env` | set one env variable | `docker run -e NODE_ENV=production` |
| `-i` | `--interactive` | keep input open (type into it) | `docker exec -i` |
| `-t` | `--tty` | give a real terminal (prompt) | `docker exec -it` |
| `-v` | `--volume` | mount a volume `name:/path` | `docker run -v data:/app` |
| `-q` | `--quiet` | IDs only (for scripting) | `docker ps -q` |
| `-a` | `--all` | include stopped/unused items | `docker ps -a`, `docker image prune -a` |

### Same letter, different meaning (watch out)
- **`-t`**: in `docker build` = **tag**; in `docker exec -it` = **tty** (terminal).
- **`-f`**: in `docker rm` = **force**; in `docker logs -f` = **follow** (live); in `docker build -f Dockerfile.dev` = **file** (which Dockerfile).
- **`-a`**: in `docker ps -a` = all containers; in `docker image prune -a` = all unused images.

### `-it` combo (most common)
```bash
docker exec -it <name> sh
```
`-i` (keep input open) + `-t` (real terminal) = an interactive shell you can type into. Without both, the shell opens and exits instantly.

### Check any command's flags
```bash
docker run --help
docker build --help
```
