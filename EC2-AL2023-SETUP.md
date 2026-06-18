# EC2 Amazon Linux 2023 — Docker Deployment Setup Guide

Fresh Amazon Linux 2023 EC2 → running client + server containers connected to host Postgres.

---

## Architecture

```
EC2 Amazon Linux 2023
├── Postgres        (installed on host — not containerized)
├── Docker
│   ├── client container  (nginx:80  — serves React + proxies /api)
│   └── server container  (Express:5000 — API only)
└── GitHub Actions  (SSH in → git pull → docker compose up --build -d)
```

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
9. [Create .env File](#9-create-env-file)
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

### Create the database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE todos;
\q
```

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
# Should see: server/ client/ docker-compose.prod.yml etc.
```

---

## 9. Create .env File

The `.env` file is never in git — create it manually on the server.

```bash
nano ~/CI-CD/server/.env
```

Paste:

```
PORT=5000

DB_USER=postgres
DB_PASS=yourpassword
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=todos
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

Verify:

```bash
cat ~/CI-CD/server/.env
```

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
- Builds `server` image from `server/Dockerfile`
- Builds `client` image from `client/Dockerfile`
- Starts both containers in the background
- Creates shared `todo-network`
- Injects env vars from `server/.env`

---

## 12. Verify Everything Works

```bash
# Check both containers are running
docker compose -f docker-compose.prod.yml ps

# Server logs — should show "Database table ready" + "Server running on port 5000"
docker compose -f docker-compose.prod.yml logs server

# Client logs
docker compose -f docker-compose.prod.yml logs client

# Test API directly
curl http://localhost:5000/api/health

# Test nginx
curl http://localhost
```

Open in browser:

```
http://your-ec2-public-ip
```

---

## 13. EC2 Security Group Settings

In AWS Console → EC2 → Security Groups → Inbound Rules:

| Type | Port | Source | Why |
|---|---|---|---|
| HTTP | 80 | 0.0.0.0/0 | nginx serves the app |
| SSH | 22 | Your IP | SSH access |
| Custom TCP | 5000 | Your IP only | Direct API testing (optional) |

> Port 5000 should NOT be open to `0.0.0.0/0` — all traffic should go through nginx on port 80.
> Port 5432 (Postgres) should never be open publicly.

---

## Common Commands After Setup

```bash
# View running containers
docker compose -f docker-compose.prod.yml ps

# Live logs from all containers
docker compose -f docker-compose.prod.yml logs -f

# Live logs from one container
docker compose -f docker-compose.prod.yml logs -f server

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
