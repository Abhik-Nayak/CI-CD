# EC2 Amazon Linux 2023 — Docker Deployment Setup Guide

Fresh Amazon Linux 2023 EC2 → running a microservices stack (client + gateway + auth-service + todo-service) connected to host Postgres.

---

## Architecture

```
EC2 Amazon Linux 2023
├── Postgres        (installed on host — not containerized)
│   ├── auth_db     (users)
│   └── todo_db     (todos)
├── Docker  (only the client publishes a port; everything else is internal)
│   ├── client container        (nginx:80 — serves React + forwards /api → gateway)
│   ├── gateway container        (nginx — routes /api/auth and /api/todos)
│   ├── auth-service container   (Express:5002 — signup/login, owns auth_db)
│   └── todo-service container   (Express:5001 — todo CRUD, owns todo_db)
└── GitHub Actions  (SSH in → git pull → docker compose up --build -d)
```

Request flow: `Browser → client:80 → gateway → auth-service / todo-service → Postgres`.
Only port **80** is exposed to the internet; services and the gateway live on the internal Docker network.

---

## Table of Contents

1. [Connect to EC2](#1-connect-to-ec2)
2. [Update System](#2-update-system)
3. [Install Git](#3-install-git)
4. [Install Node.js](#4-install-nodejs)
5. [Install Docker](#5-install-docker)
6. [Install Docker Compose](#6-install-docker-compose)
7. [Install & Configure PostgreSQL](#7-install--configure-postgresql)
8. [Clone Repository](#8-clone-repository)
9. [Create .env Files (one per service)](#9-create-env-files-one-per-service)
10. [Configure Postgres for Docker Access](#10-configure-postgres-for-docker-access)
11. [Run with Docker Compose](#11-run-with-docker-compose)
12. [Verify Everything Works](#12-verify-everything-works)
13. [EC2 Security Group Settings](#13-ec2-security-group-settings)

---

## 1. Connect to EC2

From your local machine:

```bash
ssh -i your-key.pem ec2-user@your-ec2-public-ip
```

> Default username for Amazon Linux 2023 is `ec2-user`.

---

## 2. Update System

Always update first on a fresh server:

```bash
sudo dnf update -y
```

---

## 3. Install Git

Git comes pre-installed on AL2023. Verify:

```bash
git --version
```

If missing:

```bash
sudo dnf install -y git
```

---

## 4. Install Node.js

Not needed to run the app (Docker handles it), but useful for debugging on the server.

```bash
# Node.js 22 is available directly in AL2023 extras
sudo dnf install -y nodejs

# Verify
node --version
npm --version
```

---

## 5. Install Docker

```bash
# Install Docker
sudo dnf install -y docker

# Start Docker and enable on reboot
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group — no sudo needed for docker commands
sudo usermod -aG docker ec2-user

# Verify Docker is running
sudo systemctl status docker
```

> **Important:** After `usermod`, log out and back in for the group change to take effect.

```bash
exit
# SSH back in
ssh -i your-key.pem ec2-user@your-ec2-public-ip
```

Test Docker without sudo:

```bash
docker ps
docker --version
```

---

## 6. Install Docker Compose

```bash
# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verify
docker compose version
```

---

## 7. Install & Configure PostgreSQL

AL2023 ships with PostgreSQL 15.

```bash
# Install Postgres
sudo dnf install -y postgresql15-server postgresql15

# Initialize the database (required on first install — creates data directory)
sudo postgresql-setup --initdb

# Start and enable Postgres
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
sudo systemctl status postgresql
```

### Set postgres user password

```bash
sudo -u postgres psql
```

Inside psql:

```sql
ALTER USER postgres WITH PASSWORD 'yourpassword';
\q
```

### Create the databases (one per service)

Microservices use the **database-per-service** pattern — each service owns its own
database. They're two separate databases on the **same** Postgres instance.

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE auth_db;   -- owned by auth-service (users table)
CREATE DATABASE todo_db;   -- owned by todo-service (todos table)
\q
```

> The tables themselves are created automatically on first run — each service runs
> its own `CREATE TABLE IF NOT EXISTS` at startup.

---

## 8. Clone Repository

```bash
cd ~
git clone https://github.com/your-username/CI-CD.git
cd CI-CD

# Switch to dev branch
git checkout dev
git pull origin dev
```

Verify files are there:

```bash
ls
# Should see: services/ client/ docker-compose.prod.yml etc.

ls services
# Should see: auth-service/ todo-service/ gateway/
```

---

## 9. Create .env Files (one per service)

`.env` files are never in git — create them manually on the server. Each service
has its own, pointing at its own database. **`JWT_SECRET` must be identical in both**
(auth-service signs the token, todo-service verifies it).

First, generate one strong secret to reuse in both files:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# copy the output — paste the SAME value as JWT_SECRET in both files below
```

### auth-service

```bash
nano ~/CI-CD/services/auth-service/.env
```

```
PORT=5002

DB_USER=postgres
DB_PASS=yourpassword
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=auth_db

JWT_SECRET=paste-the-generated-secret-here
```

### todo-service

```bash
nano ~/CI-CD/services/todo-service/.env
```

```
PORT=5001

DB_USER=postgres
DB_PASS=yourpassword
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=todo_db

JWT_SECRET=paste-the-SAME-generated-secret-here
```

Save each: `Ctrl+O` → `Enter` → `Ctrl+X`

Verify (the two `JWT_SECRET` values must match exactly):

```bash
cat ~/CI-CD/services/auth-service/.env
cat ~/CI-CD/services/todo-service/.env
```

> The gateway has **no** `.env` — it only routes traffic and holds no secrets.

---

## 10. Configure Postgres for Docker Access

By default Postgres only listens on `localhost` and only trusts local connections. Docker containers connect from a different network interface — two config changes needed.

### Find config file locations

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
```

> On AL2023 the files are typically at `/var/lib/pgsql/data/`

### Edit postgresql.conf — allow external connections

```bash
sudo nano /var/lib/pgsql/data/postgresql.conf
```

Find and change:

```
# Before:
#listen_addresses = 'localhost'

# After:
listen_addresses = '*'
```

### Edit pg_hba.conf — allow Docker subnet

```bash
sudo nano /var/lib/pgsql/data/pg_hba.conf
```

Add this line at the bottom:

```
# Allow Docker containers (172.17.0.0/16 is Docker's default bridge subnet)
host    all    all    172.17.0.0/16    md5
```

> AL2023 Postgres uses `scram-sha-256` by default. If you see auth errors, change the existing `local` and `host` entries from `scram-sha-256` to `md5` as well.

### Restart Postgres

```bash
sudo systemctl restart postgresql

# Verify
sudo systemctl status postgresql
```

---

## 11. Run with Docker Compose

```bash
cd ~/CI-CD
docker compose -f docker-compose.prod.yml up --build -d
```

This command:
- Builds 4 images: `auth-service`, `todo-service`, `gateway`, `client`
- Starts all 4 containers in the background
- Creates shared `todo-network` (containers find each other by service name via Docker DNS)
- Injects env vars from each service's `.env`
- Publishes only port **80** (the client) to the host

---

## 12. Verify Everything Works

```bash
# All 4 containers should be running
docker compose -f docker-compose.prod.yml ps

# Service logs — should show "<db> tables ready" + "<service> running on port ..."
docker compose -f docker-compose.prod.yml logs auth-service
docker compose -f docker-compose.prod.yml logs todo-service

# Gateway + client logs
docker compose -f docker-compose.prod.yml logs gateway
docker compose -f docker-compose.prod.yml logs client

# Test the SPA loads
curl http://localhost

# Test the full chain end-to-end (browser → client → gateway → auth-service).
# Expect a JSON error like {"error":"Invalid credentials"} — that proves routing
# all the way to the service works.
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"wrongpass"}'
```

> Services and the gateway are NOT exposed to the host — you can only reach them
> through `http://localhost` (the client on port 80). That's intentional.

Open in browser:

```
http://your-ec2-public-ip
```

---

## 13. EC2 Security Group Settings

In AWS Console → EC2 → Security Groups → Inbound Rules:

| Type | Port | Source | Why |
|---|---|---|---|
| HTTP | 80 | 0.0.0.0/0 | client nginx serves the app — the only public entry |
| SSH | 22 | Your IP | SSH access |

> Only port **80** is open. The service ports (5001/5002), the gateway, and Postgres
> (5432) are never published to the host or the internet — all traffic flows through
> the client on port 80, then the gateway, then to the services internally.

---

## Common Commands After Setup

```bash
# View running containers
docker compose -f docker-compose.prod.yml ps

# Live logs from all containers
docker compose -f docker-compose.prod.yml logs -f

# Live logs from one container (auth-service | todo-service | gateway | client)
docker compose -f docker-compose.prod.yml logs -f auth-service

# Restart all containers
docker compose -f docker-compose.prod.yml restart

# Pull latest code and redeploy (what GitHub Actions does)
cd ~/CI-CD
git checkout dev
git pull origin dev
docker compose -f docker-compose.prod.yml up --build -d

# Stop everything
docker compose -f docker-compose.prod.yml down

# Full reset
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up --build -d
```

---

## AL2023 vs Ubuntu — Key Differences

| | Amazon Linux 2023 | Ubuntu |
|---|---|---|
| Package manager | `dnf` | `apt` |
| Default user | `ec2-user` | `ubuntu` |
| Docker install | `dnf install docker` | Add Docker repo first |
| Postgres init | `postgresql-setup --initdb` required | Auto-initialized |
| Postgres config path | `/var/lib/pgsql/data/` | `/etc/postgresql/*/main/` |
| Postgres default auth | `scram-sha-256` | `md5` |

---

## What GitHub Actions Does Automatically

Once this is set up manually and working, every push to `dev` branch triggers:

```
GitHub Actions (ubuntu-latest runner)
    │
    └── SSH into EC2
            │
            ├── git checkout dev
            ├── git pull origin dev
            └── docker compose -f docker-compose.prod.yml up --build -d
```

The `.env` file stays on EC2 permanently — never touched by the workflow.
