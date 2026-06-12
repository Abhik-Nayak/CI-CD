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

## 2. IMAGES

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
