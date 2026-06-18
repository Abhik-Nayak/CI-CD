# Docker Interview Q&A — Top 20 (80/20 Rule)

> These 20 cover ~80% of Docker interview questions. Answers are concise but complete enough to say out loud.

---

### 1. What is Docker and why use it?
Docker packages an app with all its dependencies (runtime, libraries, config) into a portable **image** that runs identically on any machine. Solves "works on my machine" — same behavior on your laptop, a teammate's, and production. Lighter and faster to start than VMs because containers share the host OS kernel.

---

### 2. Image vs Container?
- **Image** = a read-only template/blueprint (app + dependencies + OS layers). Built once.
- **Container** = a running instance of an image. You can run many containers from one image.

Analogy: image is a **class**, container is an **object**. Or image = recipe, container = the cooked dish.

---

### 3. Container vs Virtual Machine?
| | Container | VM |
|--|-----------|-----|
| OS | Shares host kernel | Full guest OS each |
| Size | MBs | GBs |
| Startup | Seconds | Minutes |
| Isolation | Process-level | Hardware-level (stronger) |

Containers are lighter and faster; VMs give stronger isolation. Containers virtualize the **OS**, VMs virtualize the **hardware**.

---

### 4. What is a Dockerfile?
A text file with instructions to build an image — the recipe. Each instruction (`FROM`, `COPY`, `RUN`, `CMD`, etc.) creates a cached **layer**. Docker reuses unchanged layers on rebuild, making builds fast.

---

### 5. Common Dockerfile instructions?
- `FROM` — base image
- `WORKDIR` — working directory inside image
- `COPY` / `ADD` — copy files in (`ADD` also handles URLs/tar extraction)
- `RUN` — execute a command at **build** time (e.g. `npm ci`)
- `ENV` — set environment variable
- `ARG` — build-time variable (only available during build)
- `EXPOSE` — document the port (doesn't actually publish it)
- `CMD` — default command at **run** time (overridable)
- `ENTRYPOINT` — fixed command at run time (not easily overridden)

---

### 6. CMD vs ENTRYPOINT?
- `CMD` = default command, **easily overridden** by args in `docker run`.
- `ENTRYPOINT` = the main executable, args passed to `docker run` are **appended** to it.

Common pattern: `ENTRYPOINT ["node"]` + `CMD ["index.js"]` → runs `node index.js`, but you can override the file.

---

### 7. COPY vs ADD?
Both copy files into the image. **Prefer `COPY`** — it's explicit and predictable. `ADD` has extra magic: it can auto-extract local tar files and download from URLs. Use `ADD` only when you specifically need those.

---

### 8. What is a multi-stage build and why use it?
Using multiple `FROM` stages in one Dockerfile. You build/compile in one stage, then copy **only the output** into a clean final stage. Result: smaller, more secure production image (no build tools, dev dependencies, or source left behind).

Example: client builds React with Node (~180MB stage), then serves the `dist` folder with nginx (~40MB final image).

---

### 9. What is `.dockerignore`?
Like `.gitignore` — lists files/folders excluded from the **build context** sent to the Docker daemon. Critical to ignore `node_modules`, `.env`, `.git`. Speeds up builds and prevents secrets or host `node_modules` from being baked into the image.

---

### 10. Why does `localhost` not work inside a container?
Inside a container, `localhost` (127.0.0.1) refers to the **container itself**, not the host machine. To reach a service on the host (e.g. local Postgres), use `host.docker.internal` (Docker Desktop) or `--add-host=host.docker.internal:host-gateway` on Linux. To reach another container, use its name on a shared network.

---

### 11. What is a Docker volume and when do you need one?
A volume stores data **outside** the container's writable layer so it survives `docker rm`, restarts, and rebuilds. Needed for **stateful** containers — databases, uploaded files, etc. Containers are ephemeral; without a volume, all data inside is lost when the container is removed.

---

### 12. Bind mount vs Volume?
- **Volume** — managed by Docker, stored in Docker's area. Best for production data persistence.
- **Bind mount** — maps a specific **host folder** into the container. Best for local dev (live code reload). Tightly coupled to host path.

---

### 13. How do containers communicate?
Put them on the same **user-defined network**. Docker provides internal DNS — a container's `--name` becomes a resolvable hostname (e.g. nginx → `http://server:5000`). The **default bridge network has no DNS**, which is why you create a custom network.

---

### 14. Difference between the bridge, host, and none networks?
- **bridge** (default) — isolated internal network; containers get private IPs. Custom bridges add name-based DNS.
- **host** — container shares the host's network stack directly (no isolation, no port mapping needed).
- **none** — no networking at all.

---

### 15. EXPOSE vs `-p` (publish)?
- `EXPOSE` in the Dockerfile is **documentation only** — it doesn't open any port.
- `-p HOST:CONTAINER` in `docker run` actually **publishes** the port, forwarding host traffic into the container. Only `-p` makes the app reachable from your machine.

---

### 16. ENV vs ARG?
- `ARG` — available only at **build time** (e.g. `--build-arg VITE_API_URL=...`). Gone at runtime.
- `ENV` — available at **build AND run time**, persists in the running container.

Tip: secrets should be injected at runtime via `--env-file` / `-e`, never baked in as `ENV` or `ARG`.

---

### 17. How do you reduce Docker image size?
- Use small base images (`alpine`).
- Multi-stage builds (drop build tools from final image).
- `npm ci --omit=dev` to skip dev dependencies.
- Combine `RUN` commands to reduce layers; clean caches in the same layer.
- Use `.dockerignore` to avoid copying junk.

---

### 18. What is Docker Compose and why use it?
A tool to define and run **multi-container** apps with one YAML file (`docker-compose.yml`). One command (`docker compose up -d --build`) builds images, creates the network, and starts all services with their config — replacing many manual `docker build`/`network`/`run` commands. Great for local dev and multi-service stacks.

---

### 19. `docker stop` vs `docker kill`?
- `stop` — **graceful**: sends `SIGTERM`, waits ~10s for cleanup (close DB connections, finish requests), then `SIGKILL`.
- `kill` — **immediate**: sends `SIGKILL` right away, no cleanup. Use only if `stop` hangs.

---

### 20. How do you debug a container that keeps crashing?
1. `docker ps -a` — check exit status.
2. `docker logs <name>` — read the error (most issues are here).
3. `docker exec -it <name> sh` — if it stays up, get inside to check files/env.
4. `docker inspect <name>` — verify env vars, mounts, network.
5. Common causes: missing env vars, wrong `CMD`, port conflict, can't reach DB (`localhost` vs `host.docker.internal`), out-of-sync lockfile breaking `npm ci`.

---

## Bonus rapid-fire
- **Layer** — a cached step from one Dockerfile instruction; reused if unchanged.
- **Registry** — where images are stored/shared (Docker Hub, ECR, GHCR).
- **`docker pull` / `push`** — download / upload images to a registry.
- **Why non-root user in container?** — if the app is exploited, attacker gets a limited user, not root on the host.
- **`-d` flag** — detached/background. **`-it`** — interactive terminal (for shells).
- **Container is stateless?** — its writable layer is ephemeral; persist data with volumes.
