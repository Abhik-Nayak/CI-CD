# Microservice Migration Plan

> Goal: split the monolith Express API into 2 microservices to learn microservice architecture in Docker.
> DB: single local Postgres (laptop for local, EC2's local Postgres for deploy). No RDS, no DB containers.
> Branch: `docker-microservice-dev`

---

## Target architecture

```
Browser
  │
  ▼
client (nginx gateway :80)
  ├── /api/auth   → auth-service:5002
  └── /api/todos  → todo-service:5001
                        │            │
                        ▼            ▼
                   auth_db        todo_db      (2 databases on the same local Postgres)
                   (users)        (todos)
```

Database-per-service is applied **logically**: two separate databases on one Postgres, not new servers.

---

## Steps

### 1. Databases
Create two databases on local Postgres (and EC2 later):
- `auth_db` — owns `users`
- `todo_db` — owns `todos`

### 2. Restructure folders
```
auth-service/   ← signup, login, JWT issue   (from server/routes/auth.js)
todo-service/   ← todo CRUD                    (from server/routes/todos.js)
client/         ← unchanged
```
Each service gets its own `Dockerfile`, `db.js`, `package.json`, `.env`.

### 3. Tables
- `auth_db`: `users`
- `todo_db`: `todos` — **drop `REFERENCES users(id)`**. Keep `user_id` as a plain column, filled from the verified JWT.
- Reason: `users` and `todos` now live in different databases → no cross-DB foreign key / JOIN possible. This is the core decoupling lesson.

### 4. Auth between services
- auth-service signs the JWT (owns `JWT_SECRET`).
- todo-service verifies the same JWT (shares `JWT_SECRET`), reads `user_id` from the token. No DB call to auth-service.

### 5. nginx gateway (`client/nginx.conf`)
```
/api/auth   → auth-service:5002
/api/todos  → todo-service:5001
```

### 6. Compose (both `docker-compose.yml` + `docker-compose.prod.yml`)
- services: `auth-service`, `todo-service`, `client`
- each service: own `DB_NAME`, same `DB_HOST: host.docker.internal`, same `JWT_SECRET`.

### 7. CI/CD
- No change needed — same `docker compose up --build` deploy.

---

## Note
For a tiny todo app, microservices are over-engineering — in the real world this stays a monolith.
This is a **learning exercise** to understand the mechanics, not a template for small apps.
