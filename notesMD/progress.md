# Docker Learning Progress

> Tracking what I've learned on the path to CI/CD + DevOps.
> Last updated: 2026-06-22

---

## ✅ Done so far

I can now **create and run** each of these from scratch:

| Concept | What I can do | Key command |
|---------|---------------|-------------|
| **Image** | Build from a Dockerfile, tag, list, remove | `docker build -t name:tag .` |
| **Container** | Run detached, name it, map ports, pass env | `docker run -d --name x -p 80:80 image` |
| **Network** | Create a bridge, connect containers, inspect | `docker network create todo-net` |
| **Volume** | Create, mount, inspect, understand when needed | `docker run -v data:/path image` |
| **Compose** | Build + run the whole stack from one YAML | `docker compose up -d --build` |

### What clicked
- **Image vs Container** — image = blueprint, container = running instance of it.
- **Why `--env-file`** — `docker run` doesn't auto-load `.env`; compose did it for me.
- **Why `DB_HOST=host.docker.internal`** — inside a container `localhost` = the container, not my PC; this reaches host Postgres.
- **Why a custom network** — default bridge has no DNS, so nginx couldn't resolve `server`. A named network gives container-name DNS.
- **When a volume is needed** — only when data lives *inside* a container (e.g. a Postgres container). This project uses host Postgres, so containers stay stateless → no volume needed.
- **Compose = all the manual steps in one file** — build, network, run, env, naming all automatic.

### Notes I've written
- [DOCKER-COMMANDS.md](DOCKER-COMMANDS.md) — full command reference
- [dockerstep.md](dockerstep.md) — manual run (no compose) + compose comparison
- [DOCKER-QNA.md](DOCKER-QNA.md) / [DOCKER-INTERVIEW-QNA.md](DOCKER-INTERVIEW-QNA.md) — Q&A practice

---

## 🔜 Next up

- [ ] **Multi-stage builds** — smaller images (build stage vs runtime stage)
- [ ] **Dockerfile best practices** — layer caching, `.dockerignore`, `COPY` order
- [ ] **Docker Hub / registry** — `docker tag`, `docker push`, `docker pull` a private image
- [ ] **Environment management** — dev vs prod compose files (`docker-compose.prod.yml`)
- [ ] **Healthchecks & restart policies** — `restart: unless-stopped`, `HEALTHCHECK`

## 🎯 Toward CI/CD (the goal)

- [ ] **GitHub Actions** — build image on push, run tests
- [ ] **Push image to registry** from the pipeline
- [ ] **Deploy to EC2** — pull image + `docker compose up` on the server
- [ ] **Secrets management** — env vars / secrets in the pipeline (not committed)
- [ ] **Zero-downtime deploy** — rolling restart / reverse proxy

---

## Reflection
The mental model I'm building: **Dockerfile → image → container**, wired together with
**networks** (so they talk) and **volumes** (so data survives), orchestrated by **compose**
locally — and soon by a **CI/CD pipeline** automatically.
