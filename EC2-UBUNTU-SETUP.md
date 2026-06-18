# EC2 Ubuntu — Docker Deployment Setup Guide

Fresh Ubuntu EC2 → running client + server containers connected to host Postgres.

---

## Architecture

```
EC2 Ubuntu
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
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

> Default username for Ubuntu EC2 is `ubuntu`, not `ec2-user`.

---

## 2. Update System

Always update first on a fresh server:

```bash
sudo apt update -y && sudo apt upgrade -y
```

---

## 3. Install Git

```bash
sudo apt install -y git

# Verify
git --version
```

---

## 4. Install Node.js

Not needed to run the app (Docker handles it), but useful for debugging on the server.

```bash
# Install Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

---

## 5. Install Docker

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update -y
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker (auto-start on reboot)
sudo systemctl start docker
sudo systemctl enable docker

# Add ubuntu user to docker group — no sudo needed for docker commands
sudo usermod -aG docker ubuntu

# Verify
docker --version
```

> **Important:** After `usermod`, log out and back in for the group change to take effect.

```bash
exit
# SSH back in
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

Test Docker without sudo:

```bash
docker ps
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

```bash
# Install Postgres
sudo apt install -y postgresql postgresql-contrib

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

```sql
-- Still inside psql or reconnect:
sudo -u postgres psql
CREATE DATABASE todos;
\q
```

---

## 8. Clone Repository

```bash
cd ~
git clone https://github.com/your-username/CI-CD.git
cd CI-CD

# Switch to the dev branch
git checkout dev
git pull origin dev
```

Verify the files are there:

```bash
ls
# Should see: server/ client/ docker-compose.prod.yml Dockerfile etc.
```

---

## 9. Create .env File

The `.env` file is never in git — create it manually on the server.

```bash
nano ~/CI-CD/server/.env
```

Paste the following (update values to match your setup):

```
PORT=5000

DB_USER=postgres
DB_PASS=yourpassword
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=todos
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

Verify it saved:

```bash
cat ~/CI-CD/server/.env
```

---

## 10. Configure Postgres for Docker Access

By default Postgres only accepts connections from `localhost`. Docker containers connect from a different network interface, so two config changes are needed.

### Find config file locations

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
```

### Edit postgresql.conf — allow external connections

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
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
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Add this line at the bottom:

```
# Allow Docker containers (172.17.0.0/16 is Docker's default bridge subnet)
host    all    all    172.17.0.0/16    md5
```

### Restart Postgres

```bash
sudo systemctl restart postgresql

# Verify it's running
sudo systemctl status postgresql
```

---

## 11. Run with Docker Compose

```bash
cd ~/CI-CD
docker compose -f docker-compose.prod.yml up --build -d
```

This command:
- Builds the `server` image from `server/Dockerfile`
- Builds the `client` image from `client/Dockerfile`
- Starts both containers in the background
- Creates the shared `todo-network`
- Injects env vars from `server/.env`

---

## 12. Verify Everything Works

```bash
# Check both containers are running
docker compose -f docker-compose.prod.yml ps

# Check server logs — should show "Database table ready" + "Server running on port 5000"
docker compose -f docker-compose.prod.yml logs server

# Check client logs
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

# Live logs
docker compose -f docker-compose.prod.yml logs -f

# Restart all containers
docker compose -f docker-compose.prod.yml restart

# Pull latest code and redeploy
cd ~/CI-CD
git checkout dev
git pull origin dev
docker compose -f docker-compose.prod.yml up --build -d

# Stop everything
docker compose -f docker-compose.prod.yml down

# Full reset (keeps .env and postgres data)
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up --build -d
```

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

The `.env` file stays on EC2 permanently — it is never touched by the workflow.
