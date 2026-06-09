# Docker Commands — Complete Cheat Sheet

---

## Table of Contents

1. [Docker Info & Version](#1-docker-info--version)
2. [Images](#2-images)
3. [Containers — Run, Stop, Remove](#3-containers--run-stop-remove)
4. [Logs](#4-logs)
5. [Execute Inside a Container](#5-execute-inside-a-container)
6. [Inspect & Debug](#6-inspect--debug)
7. [Networks](#7-networks)
8. [Volumes](#8-volumes)
9. [System & Disk Usage](#9-system--disk-usage)
10. [Cleanup](#10-cleanup)
11. [Save & Load Images](#11-save--load-images)
12. [Docker Compose](#12-docker-compose)
13. [Dockerfile — Build Your Own Image](#13-dockerfile--build-your-own-image)
14. [Quick Test — Run Nginx in 60 Seconds](#14-quick-test--run-nginx-in-60-seconds)
15. [Health Check — See Everything at Once](#15-health-check--see-everything-at-once)

---

## How Docker Fits Together

```
Dockerfile          docker build         docker run           User
(recipe)            (cook it)            (serve it)           (access it)
    │                   │                    │                    │
    ▼                   ▼                    ▼                    ▼
┌──────────┐      ┌──────────┐        ┌───────────┐       ┌───────────┐
│ FROM     │      │  Image   │        │ Container │       │ Browser   │
│ COPY     │ ──►  │ (frozen  │  ──►   │ (running  │ ──►   │ localhost │
│ RUN      │      │  snapshot)│        │  process) │       │ :8080     │
│ CMD      │      └──────────┘        └───────────┘       └───────────┘
└──────────┘
```

---

## 1. Docker Info & Version

```bash
docker --version          # Short version (e.g., Docker version 24.0.7)
docker version            # Detailed — shows client AND server versions
docker info               # Everything — containers, images, storage, OS, etc.
```

| Command | When to use |
|---|---|
| `docker --version` | Quick check — "is Docker installed?" |
| `docker version` | Debugging — check if client and server match |
| `docker info` | Deep check — storage driver, running containers count, etc. |

---

## 2. Images

An **image** is a frozen snapshot of your app + dependencies. You either **pull** one from Docker Hub or **build** your own from a Dockerfile.

```bash
# --- List Images ---
docker images             # Show all images on your machine
docker image ls           # Same thing, newer syntax

# --- Pull from Docker Hub ---
docker pull nginx         # Download the nginx image
docker pull ubuntu        # Download the ubuntu image
docker pull node:18-alpine  # Download specific version (tag)

# --- Build Your Own ---
docker build -t my-app .                # Build from Dockerfile in current directory
docker build -t my-app:v2 .             # Build with a version tag
docker build -t my-backend ./server     # Build from a specific folder

# --- Remove ---
docker rmi nginx          # Remove by name
docker rmi <image_id>     # Remove by ID
docker rmi -f nginx       # Force remove (even if container exists)
```

### How Image Names Work

```
docker pull  node:18-alpine
             ─┬──  ──┬──────
              │      │
              │      └── Tag (version) — default is "latest" if you don't specify
              └── Image name (from Docker Hub)

docker build -t  my-backend:v2  ./server
                 ──┬────────┬─  ──┬─────
                   │        │     │
                   │        │     └── Build context (folder with Dockerfile)
                   │        └── Tag
                   └── Image name (you choose)
```

---

## 3. Containers — Run, Stop, Remove

A **container** is a running instance of an image. One image can create many containers.

### Running Containers

```bash
# --- Basic Run ---
docker run hello-world                    # Run and print a test message

# --- Run in Background (Detached) ---
docker run -d --name mynginx -p 8080:80 nginx
#          │   │              │            │
#          │   │              │            └── Image to use
#          │   │              └── Port mapping: YOUR_PORT:CONTAINER_PORT
#          │   └── Give it a name (instead of random name)
#          └── Detached mode (runs in background)

# --- Run Interactively (go inside) ---
docker run -it ubuntu bash
#          │          │
#          │          └── Command to run inside
#          └── Interactive + TTY (gives you a terminal)

# --- Run with Environment Variables ---
docker run -d --name myapp -p 5000:5000 -e NODE_ENV=production my-backend
#                                       │
#                                       └── Set env variable

# --- Run with Volume (persist data) ---
docker run -d --name mydb -v mydata:/var/lib/data myimage
#                         │
#                         └── Mount volume: VOLUME_NAME:PATH_INSIDE_CONTAINER
```

### Viewing Containers

```bash
docker ps                 # Show only RUNNING containers
docker ps -a              # Show ALL containers (running + stopped)
```

**Reading `docker ps` output:**

```
CONTAINER ID   IMAGE   COMMAND       STATUS          PORTS                  NAMES
a1b2c3d4e5f6   nginx   "/docker…"   Up 5 minutes    0.0.0.0:8080->80/tcp   mynginx
                                     ──┬──────────
                                       │
                                       └── "Up" = running, "Exited" = stopped
```

### Stop, Start, Restart, Remove

```bash
# --- Lifecycle ---
docker stop mynginx       # Gracefully stop (sends SIGTERM, waits, then SIGKILL)
docker start mynginx      # Start a stopped container
docker restart mynginx    # Stop + Start in one command

# --- Remove ---
docker rm mynginx         # Remove a STOPPED container
docker rm -f mynginx      # Force remove a RUNNING container (stop + remove)
```

### Container Lifecycle

```
docker run              docker stop             docker start
    │                       │                       │
    ▼                       ▼                       ▼
┌─────────┐           ┌──────────┐            ┌─────────┐
│ Running │ ────────► │ Stopped  │ ─────────► │ Running │
└─────────┘           └──────────┘            └─────────┘
                           │
                      docker rm
                           │
                           ▼
                      ┌──────────┐
                      │ Removed  │
                      └──────────┘
```

---

## 4. Logs

Logs show you what's happening inside a container — errors, output, requests.

```bash
docker logs mynginx               # Show all logs
docker logs -f mynginx            # Follow live (like tail -f) — Ctrl+C to exit
docker logs --tail 50 mynginx     # Last 50 lines only
docker logs --since 1h mynginx    # Logs from last 1 hour
docker logs --timestamps mynginx  # Show timestamps on each line
```

| Flag | What it does |
|---|---|
| `-f` | Follow — stream new logs as they appear |
| `--tail N` | Show only last N lines |
| `--since` | Time filter (`1h`, `30m`, `2024-01-01`) |
| `--timestamps` | Add timestamp to each log line |

---

## 5. Execute Inside a Container

Run commands inside a **running** container — useful for debugging.

```bash
docker exec -it mynginx bash      # Open a bash shell inside the container
docker exec -it mynginx sh        # Use sh if bash is not available (Alpine images)
docker exec mynginx ls /app       # Run a single command (no shell)
docker exec mynginx cat /etc/os-release   # Check what OS is inside
```

**What `-it` means:**

| Flag | Meaning |
|---|---|
| `-i` | Interactive — keep stdin open (so you can type) |
| `-t` | TTY — allocate a terminal (so you get a proper prompt) |
| `-it` | Both together — gives you a normal terminal experience |

**When you're inside the container:**
```bash
# You're now inside the container's filesystem
ls                    # See files
cat /etc/os-release   # Check OS
env                   # See environment variables
exit                  # Leave the container (container keeps running)
```

---

## 6. Inspect & Debug

Get detailed JSON info about a container or image.

```bash
docker inspect mynginx            # Full details — config, network, mounts, etc.
docker inspect <container_id>     # Same but by ID

# --- Useful Filtered Inspects ---
docker inspect --format '{{.State.Status}}' mynginx        # Just status
docker inspect --format '{{.NetworkSettings.IPAddress}}' mynginx  # Just IP
```

---

## 7. Networks

Containers talk to each other through **networks**. Docker creates a default `bridge` network, but you can make custom ones.

```bash
# --- List & Inspect ---
docker network ls                     # Show all networks
docker network inspect bridge         # Details about the default bridge network

# --- Create ---
docker network create mynetwork       # Create a custom network

# --- Connect Containers ---
docker run -d --name app1 --network mynetwork nginx    # Start on custom network
docker network connect mynetwork existing-container    # Add existing container

# --- Remove ---
docker network rm mynetwork           # Remove a network
```

### Why Custom Networks?

```
Default bridge:                    Custom network:
┌────────────────────┐             ┌────────────────────┐
│ backend   frontend │             │ backend   frontend │
│  172.17.0.2  .0.3  │             │                    │
│                    │             │ Can use NAMES:     │
│ Must use IPs to    │             │ backend → frontend │
│ talk to each other │             │ (DNS auto-resolves)│
└────────────────────┘             └────────────────────┘
```

---

## 8. Volumes

Containers are **ephemeral** — when removed, their data is gone. **Volumes** let you persist data.

```bash
# --- List ---
docker volume ls                      # Show all volumes

# --- Create ---
docker volume create myvolume         # Create a named volume

# --- Inspect ---
docker volume inspect myvolume        # Where is it stored on the host?

# --- Use with a Container ---
docker run -d -v myvolume:/app/data myimage    # Mount volume inside container

# --- Remove ---
docker volume rm myvolume             # Remove a volume
```

### Volumes vs Bind Mounts

```
Volume (managed by Docker):           Bind Mount (your folder):
docker run -v myvolume:/app/data      docker run -v ./local-folder:/app/data

- Docker manages the storage           - You control the folder
- Best for databases, persistent data   - Best for development (live code reload)
- Portable across machines              - Tied to your file path
```

---

## 9. System & Disk Usage

```bash
docker system df              # Disk space used by images, containers, volumes
docker stats                  # LIVE CPU, memory, network per container (Ctrl+C to exit)
docker stats --no-stream      # One-time snapshot (no live updates)
```

**Reading `docker system df`:**

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          5         2         1.2GB     800MB (66%)
Containers      3         1         50MB      30MB (60%)
Volumes         2         1         200MB     100MB (50%)
                                              ─────────────
                                              Space you can reclaim with prune
```

---

## 10. Cleanup

Docker accumulates unused images, stopped containers, and orphan volumes. Clean up regularly.

```bash
# --- Targeted Cleanup ---
docker container prune        # Remove all STOPPED containers
docker image prune            # Remove dangling images (untagged)
docker image prune -a         # Remove ALL unused images (not just dangling)
docker volume prune           # Remove all unused volumes

# --- Nuclear Option ---
docker system prune           # Remove stopped containers + unused networks + dangling images
docker system prune -a        # Same + ALL unused images (reclaim maximum space)
```

### What Gets Removed?

| Command | Removes |
|---|---|
| `container prune` | Stopped containers only |
| `image prune` | Dangling (untagged) images |
| `image prune -a` | All images not used by a running container |
| `volume prune` | Volumes not attached to any container |
| `system prune` | Stopped containers + unused networks + dangling images |
| `system prune -a` | Everything above + ALL unused images |

---

## 11. Save & Load Images

Transfer images without Docker Hub — useful for air-gapped servers or backups.

```bash
# --- Save to file ---
docker save nginx -o nginx.tar           # Export image to a .tar file
docker save nginx | gzip > nginx.tar.gz  # Compressed version

# --- Load from file ---
docker load -i nginx.tar                 # Import image from .tar file
```

```
Machine A                              Machine B
┌───────────────┐    copy file     ┌───────────────┐
│ docker save   │ ──────────────►  │ docker load   │
│ → nginx.tar   │   (USB, SCP,    │ ← nginx.tar   │
│               │    S3, etc.)     │               │
│ Image ready ✓ │                  │ Image ready ✓ │
└───────────────┘                  └───────────────┘
```

---

## 12. Docker Compose

Compose lets you run **multiple containers** from one YAML file with one command.

```bash
# --- Start ---
docker compose up                 # Start all services (shows logs in terminal)
docker compose up -d              # Start in background (detached)
docker compose up -d --build      # Rebuild images THEN start (use after code changes)

# --- Stop ---
docker compose down               # Stop and REMOVE containers + network
docker compose stop               # Stop containers (keep them, can restart later)

# --- Restart ---
docker compose restart            # Restart all services
docker compose restart backend    # Restart one service

# --- Status & Logs ---
docker compose ps                 # Show running services
docker compose logs               # Logs from all services
docker compose logs backend       # Logs from one service
docker compose logs -f            # Follow logs live
docker compose logs --tail 50     # Last 50 lines

# --- Build ---
docker compose build              # Build/rebuild all images (without starting)
docker compose build backend      # Build one service's image

# --- Execute ---
docker compose exec backend sh    # Open shell inside a running service
docker compose run backend sh     # Start a NEW temporary container with shell
```

### `up` vs `down` vs `stop`

```
docker compose up -d          docker compose stop         docker compose down
       │                            │                            │
       ▼                            ▼                            ▼
┌─────────────────┐          ┌─────────────┐           ┌──────────────────┐
│ Creates:        │          │ Containers  │           │ Removes:         │
│  - Network      │          │ stop but    │           │  - Containers    │
│  - Containers   │          │ STILL EXIST │           │  - Network       │
│  - Starts apps  │          │             │           │  (images stay)   │
└─────────────────┘          │ docker      │           └──────────────────┘
                             │ compose     │
                             │ start →     │
                             │ resumes     │
                             └─────────────┘

Use stop/start when:  Pausing temporarily (data preserved)
Use down/up when:     Deploying new code (clean slate)
```

---

## 13. Dockerfile — Build Your Own Image

### Common Instructions

```dockerfile
# --- Base Image ---
FROM node:18-alpine           # Start from an existing image

# --- Set Working Directory ---
WORKDIR /app                  # All following commands run from /app

# --- Copy Files ---
COPY package*.json ./         # Copy specific files
COPY . .                      # Copy everything

# --- Run Commands (during build) ---
RUN npm ci                    # Install dependencies
RUN apt-get update && apt-get install -y curl   # Install system packages

# --- Environment Variables ---
ENV NODE_ENV=production       # Set env var (available at build + runtime)

# --- Expose Port (documentation) ---
EXPOSE 5000                   # Tells readers which port the app uses

# --- Startup Command ---
CMD ["node", "index.js"]      # Runs when container starts
```

### Build & Run

```bash
# Build
docker build -t my-app .
#             │        │
#             │        └── Build context (folder with Dockerfile)
#             └── Name your image

# Run
docker run -d --name myapp -p 5000:5000 my-app
#          │   │            │            │
#          │   │            │            └── Image name
#          │   │            └── Port mapping
#          │   └── Container name
#          └── Background mode
```

---

## 14. Quick Test — Run Nginx in 60 Seconds

Run these commands in order to verify Docker is working:

```bash
# 1. Pull the nginx image
docker pull nginx

# 2. Run it on port 8080
docker run -d --name mynginx -p 8080:80 nginx

# 3. Verify it's running
docker ps

# 4. Visit http://localhost:8080 in your browser — you should see "Welcome to nginx!"

# 5. Check logs
docker logs mynginx

# 6. Go inside the container
docker exec -it mynginx bash
# Type 'exit' to leave

# 7. Cleanup
docker stop mynginx
docker rm mynginx
```

---

## 15. Health Check — See Everything at Once

Run all of these to see the full state of your Docker system:

```bash
docker version                # Docker client + server version
docker info                   # System-wide info
docker images                 # All images
docker ps -a                  # All containers (running + stopped)
docker network ls             # All networks
docker volume ls              # All volumes
docker system df              # Disk usage summary
```

---

## Quick Reference Card

| What you want to do | Command |
|---|---|
| Check Docker is installed | `docker --version` |
| List running containers | `docker ps` |
| List all containers | `docker ps -a` |
| List images | `docker images` |
| Run a container | `docker run -d --name X -p HOST:CONTAINER image` |
| Stop a container | `docker stop X` |
| Remove a container | `docker rm X` |
| View logs | `docker logs X` or `docker logs -f X` |
| Go inside a container | `docker exec -it X sh` |
| Build an image | `docker build -t name .` |
| Start all services | `docker compose up -d --build` |
| Stop all services | `docker compose down` |
| View service logs | `docker compose logs -f` |
| Check disk usage | `docker system df` |
| Clean everything unused | `docker system prune -a` |
