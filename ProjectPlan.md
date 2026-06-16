# Microservices E‑Commerce Platform — DevOps Learning Project

> **Primary goal: DevOps learning.** The application is a *vehicle* to practice
> Docker, Compose, Redis, event-driven infra, CI/CD, monitoring, logging,
> Kubernetes and Terraform. We keep the app deliberately lean so most of the
> effort goes into infrastructure, not business logic.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Scope | **3 services**: auth, product, order | Enough to teach service calls, separate DBs, events, per-service deploy — without drowning in app code |
| Backend stack | **All Node.js / Express** | Focus on DevOps, not learning Java/Spring. Docker/K8s lessons are language-agnostic |
| Working style | **Teach-as-we-build** | Explain the *why* at each step; test in local Docker after every phase |
| Extra | **Redis** | Real infra to learn: caching, session store, rate limiting, pub/sub, queues |

## Architecture (target)

```text
                React Client (minimal)
                        |
                  API Gateway (Nginx / Node)
                        |
        --------------------------------------
        |              |               |
   auth-service   product-service  order-service
   (Node+JWT)      (Node+cache)     (Node+events)
        |              |               |
   postgres-auth  postgres-product  postgres-order
        \_____________ | _____________/
                       |
                     Redis        (cache · sessions · rate-limit · pub/sub)
                       |
              Kafka (introduced later, compared against Redis pub/sub)
```

---

## Roadmap — DevOps-first ordering

Each phase ends with **"test it in Docker on your machine"**. We do not move on
until it runs and you understand why it runs.

### PHASE 0 — Monorepo structure
Create the folder layout, root README, `.gitignore`, `.editorconfig`.

### PHASE 1 — Auth service (Node + Express + Postgres + JWT)  ⬅ *we are here*
Register / Login / Refresh / Logout. bcrypt hashing, JWT access+refresh,
refresh tokens stored in Postgres (we'll *migrate them to Redis later* — a
deliberate lesson). Dockerfile + `/health`.
- **DevOps lessons:** writing a clean Dockerfile, multi-stage builds, image
  size, `.dockerignore`, env-var config, non-root container user.

### PHASE 2 — Local Postgres in Docker
Run auth-service + its Postgres together (first `docker compose` file).
- **DevOps lessons:** Compose networking, named volumes, healthchecks,
  `depends_on`, service DNS, secrets via env.

### PHASE 3 — Product service + Redis caching
CRUD + pagination/search. Cache-aside reads in Redis with TTL + invalidation.
- **DevOps lessons:** adding stateful infra (Redis), cache patterns, observing
  cache hits/misses, Redis persistence modes.

### PHASE 4 — Order service + service-to-service calls
Create/list/cancel orders; calls product (price/stock) and validates JWT.
- **DevOps lessons:** inter-service networking, timeouts/retries, failure modes.

### PHASE 5 — Full docker-compose (all 3 services + 3 DBs + Redis)
One `docker compose up` brings the whole platform up locally.
- **DevOps lessons:** orchestrating many containers, startup ordering, profiles.

### PHASE 6 — API Gateway + Redis rate limiting
Single entry point (`/api/auth`, `/api/products`, `/api/orders`), routing,
rate limiting backed by Redis.
- **DevOps lessons:** reverse proxy, gateway patterns, distributed rate limiting.

### PHASE 7 — Sessions → Redis (refactor)
Move refresh tokens from Postgres to Redis. Compare both approaches.
- **DevOps lessons:** why externalize session state for horizontal scaling.

### PHASE 8 — Event-driven: Redis Pub/Sub → BullMQ → Kafka
notification flow on `order-created`. Start with Redis, graduate to Kafka.
- **DevOps lessons:** async messaging, at-least-once delivery, brokers.

### PHASE 9 — Minimal React frontend
Login + product list + place order. Just enough to exercise the gateway.

### PHASE 10 — CI/CD (GitHub Actions + Docker Hub)
Lint → test → build images → push → deploy.
- **DevOps lessons:** pipelines, image tagging, secrets in CI, caching layers.

### PHASE 11 — Monitoring (Prometheus + Grafana)
Per-service metrics, dashboards, alerts.

### PHASE 12 — Logging (Loki/Grafana or ELK)
Centralized structured logs with correlation IDs.

### PHASE 13 — Kubernetes
Deployments, Services, Ingress, ConfigMaps, Secrets, HPA. Local via kind/minikube.

### PHASE 14 — Terraform + AWS
VPC, subnets, SGs, RDS, EKS, ALB. Infrastructure as code.

---

## Success criteria

By the end you should be able to *explain and operate*: Docker & Compose,
Redis as infrastructure, event-driven messaging, CI/CD pipelines, monitoring,
logging, Kubernetes, and Terraform — and reason about distributed-system
trade-offs in interviews.
