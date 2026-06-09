# DevOps Notes — CI/CD, GitHub Actions, Docker & PM2

---

## Table of Contents

1. [CI/CD — The Big Picture](#1-cicd--the-big-picture)
2. [GitHub Actions Workflow](#2-github-actions-workflow)
3. [Docker — Containerization (Current Approach)](#3-docker--containerization-current-approach)
4. [Docker Deployment Flow](#4-docker-deployment-flow)
5. [PM2 — Process Manager (Previous Approach)](#5-pm2--process-manager-previous-approach)
6. [Ecosystem Config File (Previous Approach)](#6-ecosystem-config-file-previous-approach)
7. [SSH Deployment Flow (Previous — PM2)](#7-ssh-deployment-flow-previous--pm2)
8. [Common Commands Cheat Sheet](#8-common-commands-cheat-sheet)
9. [Interview Questions & Answers](#9-interview-questions--answers)

---

## 1. CI/CD — The Big Picture

### What is CI/CD?

- **CI (Continuous Integration):** Automatically test and validate code every time a developer pushes changes.
- **CD (Continuous Deployment/Delivery):** Automatically deploy the tested code to a server (like EC2).

### Why CI/CD?

| Without CI/CD | With CI/CD |
|---|---|
| Manually SSH into server | Auto-deploys on git push |
| Run `git pull` by hand | GitHub Actions does it for you |
| Forget to install dependencies | Workflow handles `npm install` |
| App crashes, nobody notices | Docker auto-restarts the app |
| "It works on my machine" | Docker = same everywhere |

### When to use CI/CD?

- When you have a server (EC2, DigitalOcean, etc.) running your app
- When multiple developers work on the same project
- When you want zero-downtime deployments
- When you're tired of manually deploying

---

## 2. GitHub Actions Workflow

### What is GitHub Actions?

GitHub Actions is a CI/CD tool built into GitHub. It runs automated tasks (called **workflows**) when events happen in your repository (like a push or pull request).

### Key Concepts

```
Repository
└── .github/
    └── workflows/
        └── deploy-dev.yml    <-- This is a workflow file
```

| Term | Meaning |
|---|---|
| **Workflow** | An automated process defined in a `.yml` file |
| **Trigger** | The event that starts the workflow (e.g., push to `dev` branch) |
| **Job** | A set of steps that run on a virtual machine (called a "runner") |
| **Step** | A single task inside a job (e.g., checkout code, SSH into server) |
| **Runner** | The virtual machine GitHub provides to run your workflow (`ubuntu-latest`) |
| **Secret** | Sensitive data (passwords, SSH keys) stored securely in GitHub |
| **Action** | A reusable step made by the community (e.g., `appleboy/ssh-action`) |

### Workflow File Structure Explained

```yaml
# WORKFLOW NAME — shown in GitHub Actions tab
name: Deploy to EC2 (Dev)

# TRIGGER — when does this workflow run?
on:
  push:
    branches:
      - dev          # Only runs when code is pushed to the "dev" branch

# JOBS — what tasks to perform
jobs:
  deploy:                        # Job name (you can name it anything)
    runs-on: ubuntu-latest       # Use Ubuntu virtual machine provided by GitHub

    steps:
      # STEP 1: Download your code onto the runner
      - name: Checkout code
        uses: actions/checkout@v4

      # STEP 2: SSH into EC2 and run commands
      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}         # Your EC2 IP address
          username: ${{ secrets.EC2_USER }}      # EC2 username (e.g., ec2-user)
          key: ${{ secrets.EC2_SSH_KEY }}        # Your private SSH key
          script: |
            cd ~/CI-CD
            git pull origin dev
            docker compose down
            docker compose up -d --build
```

### Workflow Execution Flow

```
Developer pushes to "dev" branch
        │
        ▼
GitHub detects the push
        │
        ▼
GitHub spins up an Ubuntu runner
        │
        ▼
Step 1: Checks out your code
        │
        ▼
Step 2: SSHs into your EC2 server
        │
        ▼
Runs the script on EC2:
  → git pull (get latest code)
  → docker compose down (stop old containers)
  → docker compose up -d --build (build & start new containers)
        │
        ▼
Deployment complete!
```

### GitHub Secrets

Secrets are encrypted environment variables stored in your GitHub repo. They keep sensitive data safe.

**How to create:**
GitHub Repo → Settings → Secrets and variables → Actions → New repository secret

| Secret | Value | Example |
|---|---|---|
| `EC2_HOST` | Your EC2 public IP | `13.206.56.172` |
| `EC2_USER` | SSH username | `ec2-user` |
| `EC2_SSH_KEY` | Your private SSH key (`.pem` file content) | `-----BEGIN RSA PRIVATE KEY-----...` |

**Why secrets?**
- Never hardcode passwords, IPs, or keys in your code
- Anyone who sees your repo would have access to your server
- GitHub encrypts secrets — even you can't see them after saving

### Common Workflow Triggers

```yaml
# On push to specific branch
on:
  push:
    branches: [dev, main]

# On pull request
on:
  pull_request:
    branches: [main]

# Manual trigger (click a button in GitHub)
on:
  workflow_dispatch:

# On schedule (cron)
on:
  schedule:
    - cron: '0 0 * * *'    # Every day at midnight
```

---

## 3. Docker — Containerization (Current Approach)

### What is Docker?

Docker is a tool that packages your app + all its dependencies into a **container**. A container is like a lightweight, isolated mini-computer that runs your app exactly the same way everywhere — your laptop, your teammate's laptop, or the EC2 server.

### Think of it Like This

```
Without Docker:                      With Docker:
┌────────────────────┐               ┌────────────────────┐
│     EC2 Server     │               │     EC2 Server     │
│                    │               │                    │
│  Node v18 (maybe?) │               │  ┌──────────────┐  │
│  npm packages ???  │               │  │  Backend      │  │
│  OS dependencies?? │               │  │  Node v18 ✓   │  │
│  Shared folders    │               │  │  All deps ✓   │  │
│  Port conflicts    │               │  │  Port 5000    │  │
│                    │               │  └──────────────┘  │
│  "Works on my      │               │  ┌──────────────┐  │
│   machine..." 😅   │               │  │  Frontend     │  │
│                    │               │  │  Node v18 ✓   │  │
└────────────────────┘               │  │  All deps ✓   │  │
                                     │  │  Port 5173    │  │
                                     │  └──────────────┘  │
                                     │                    │
                                     │  "Same everywhere  │
                                     │   guaranteed" ✅   │
                                     └────────────────────┘
```

### Key Docker Concepts

| Term | What it is | Real-World Analogy |
|---|---|---|
| **Image** | A blueprint/recipe for your app | A cooking recipe |
| **Container** | A running instance of an image | The actual cooked dish |
| **Dockerfile** | Instructions to build an image | Step-by-step recipe card |
| **docker-compose.yml** | Defines multiple containers together | A full menu (multiple recipes) |
| **Volume** | Persistent storage for containers | A USB drive you plug in |
| **Port Mapping** | Maps container port to host port | Forwarding a phone call |
| **Registry** | Where images are stored (Docker Hub) | An app store for images |

### Why Docker? (PM2 vs Docker)

| Feature | PM2 (Previous) | Docker (Current) |
|---|---|---|
| **Isolation** | Apps share OS, Node, and filesystem | Each app is fully isolated |
| **"Works on my machine"** | Still possible — different OS/Node versions | Eliminated — same image everywhere |
| **Dependencies** | Installed directly on server, can conflict | Each container has its own |
| **Setup on new server** | Install Node, npm, PM2, clone, configure | Install Docker, run one command |
| **Port conflicts** | Possible if apps share the host | Containers have internal ports |
| **Scaling** | PM2 cluster mode (same machine only) | Docker Compose → Docker Swarm → Kubernetes |
| **Environment parity** | Dev and prod can drift apart | Dev and prod are identical |
| **Cleanup** | Uninstalling leaves files behind | `docker rm` — gone cleanly |

### Our Architecture — Docker on EC2

```
EC2 Instance (one server)
├── Docker installed
├── docker-compose.yml (defines both containers)
│
├── Backend Container
│   ├── Node.js (isolated)
│   ├── Express + all npm packages (isolated)
│   ├── Talks to PostgreSQL on RDS
│   └── Port 5000 (mapped to host)
│
└── Frontend Container
    ├── Node.js (isolated)
    ├── React/Vite + all npm packages (isolated)
    └── Port 5173 (mapped to host)
```

### Docker Building Blocks

#### 1. Dockerfile — The Recipe

A `Dockerfile` is a text file with step-by-step instructions to build a Docker image.

**Backend Dockerfile** (`server/Dockerfile`):
```dockerfile
# Start from an official Node.js image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the code
COPY . .

# Tell Docker this container listens on port 5000
EXPOSE 5000

# Command to run when container starts
CMD ["node", "index.js"]
```

**Frontend Dockerfile** (`client/Dockerfile`):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Every Line Explained:**

| Instruction | What it does | Why |
|---|---|---|
| `FROM node:18-alpine` | Uses Node.js v18 on Alpine Linux as base | Alpine = tiny image (~50MB vs ~350MB) |
| `WORKDIR /app` | Sets `/app` as the working directory | Like doing `cd /app` inside container |
| `COPY package*.json ./` | Copies package files first | Docker caches this layer — if packages didn't change, skip `npm install` |
| `RUN npm ci` | Installs exact versions from lock file | `ci` is faster and stricter than `install` |
| `COPY . .` | Copies all project files | Done AFTER npm install so code changes don't bust the cache |
| `EXPOSE 5000` | Documents which port the app uses | Informational — you still need `-p` to actually map it |
| `CMD ["node", "index.js"]` | The command that runs when the container starts | Only one `CMD` per Dockerfile |

#### 2. docker-compose.yml — The Orchestra

Docker Compose lets you define and run **multiple containers** with a single file.

```yaml
services:
  backend:
    build:
      context: ./server              # Build from server/Dockerfile
    ports:
      - "5000:5000"                  # Host port : Container port
    environment:
      - NODE_ENV=production
    env_file:
      - ./server/.env                # Load secrets from .env file
    restart: unless-stopped          # Auto-restart if it crashes
    depends_on:
      - frontend                     # Start frontend first (optional)

  frontend:
    build:
      context: ./client              # Build from client/Dockerfile
    ports:
      - "5173:5173"                  # Host port : Container port
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

**Every Field Explained:**

| Field | What it does | Example |
|---|---|---|
| `services` | List of containers to run | `backend`, `frontend` |
| `build.context` | Folder containing the Dockerfile | `./server` |
| `ports` | Map host port to container port | `"5000:5000"` |
| `environment` | Set environment variables | `NODE_ENV=production` |
| `env_file` | Load variables from a file | `./server/.env` |
| `restart` | When to auto-restart | `unless-stopped` = always, unless you manually stop it |
| `depends_on` | Start order between services | Frontend starts before backend |

#### 3. .dockerignore — What NOT to Copy

Like `.gitignore`, but for Docker. Keeps images small and fast.

```
node_modules
npm-debug.log
.git
.gitignore
.env
Dockerfile
docker-compose.yml
*.md
```

**Why?** Without `.dockerignore`, `COPY . .` would copy `node_modules` (huge!), `.git` (unnecessary), and `.env` (secrets!) into the image.

### Docker Lifecycle

```
Dockerfile          docker build         docker run          docker stop
    │                   │                    │                    │
    ▼                   ▼                    ▼                    ▼
┌──────────┐      ┌──────────┐        ┌───────────┐       ┌───────────┐
│ Recipe    │ ──►  │  Image   │  ──►   │ Container │       │  Stopped  │
│ (text     │      │ (built   │        │ (running  │       │ container │
│  file)    │      │  snapshot)│        │  app)     │       │           │
└──────────┘      └──────────┘        └───────────┘       └───────────┘
                       │                    │                    │
                       │              docker restart             │
                       │                    │              docker rm
                       │                    ▼                    ▼
                       │              ┌───────────┐       ┌───────────┐
                       │              │ Container │       │  Removed   │
                       │              │ (running) │       └───────────┘
                       │              └───────────┘
                       │
                  You can create
                  many containers
                  from one image
```

### Docker Layer Caching — Why Order Matters

```
Dockerfile:                           What Docker does:

FROM node:18-alpine            ──►   Layer 1: Base image (cached after first build)
WORKDIR /app                   ──►   Layer 2: Set directory (cached)
COPY package*.json ./          ──►   Layer 3: Package files (cached if unchanged)
RUN npm ci                     ──►   Layer 4: Install deps (cached if packages unchanged)
COPY . .                       ──►   Layer 5: Your code (REBUILT if any code changed)
CMD ["node", "index.js"]       ──►   Layer 6: Start command (cached)

Key insight: If you change your code (Layer 5), Docker reuses
Layers 1-4 from cache. npm install doesn't re-run!

BAD order:  COPY . . → RUN npm ci   (ANY change = reinstall everything)
GOOD order: COPY package*.json → RUN npm ci → COPY . .   (code change ≠ reinstall)
```

### Restart Policies

| Policy | What it does | When to use |
|---|---|---|
| `no` | Never restart | Testing, one-time jobs |
| `always` | Always restart, even after `docker stop` | Almost never (restarts on boot even if you stopped it) |
| `unless-stopped` | Restart always, EXCEPT if you manually stopped it | **Production — this is what you want** |
| `on-failure` | Only restart if it crashed (non-zero exit code) | Background workers, cron jobs |

### Docker Setup on EC2 (One-Time)

```bash
# 1. Install Docker on Amazon Linux 2
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Log out and back in for group change to take effect
exit
# SSH back in

# 2. Install Docker Compose (standalone)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# OR install the Docker Compose plugin (newer way)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 3. Verify installation
docker --version
docker compose version

# 4. Clone your project
cd ~
git clone <your-repo-url> CI-CD
cd CI-CD

# 5. Start the app
docker compose up -d --build
```

---

## 4. Docker Deployment Flow

### The Complete Picture

```
┌──────────────┐    git push     ┌──────────────────┐
│  Developer   │ ──────────────► │     GitHub        │
│  (local PC)  │                 │   (repository)    │
└──────────────┘                 └────────┬─────────┘
                                          │
                                  push triggers
                                  GitHub Actions
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │  GitHub Runner    │
                                 │  (ubuntu-latest)  │
                                 │                   │
                                 │  Uses SSH to      │
                                 │  connect to EC2   │
                                 └────────┬─────────┘
                                          │
                                     SSH connection
                                    (using secrets)
                                          │
                                          ▼
                                 ┌──────────────────────────┐
                                 │       EC2 Server          │
                                 │                           │
                                 │  1. git pull              │
                                 │  2. docker compose down   │
                                 │  3. docker compose up -d  │
                                 │     --build               │
                                 │                           │
                                 │  ┌─────────┐ ┌─────────┐ │
                                 │  │Backend  │ │Frontend │ │
                                 │  │Container│ │Container│ │
                                 │  │  :5000  │ │  :5173  │ │
                                 │  └─────────┘ └─────────┘ │
                                 └──────────────────────────┘
```

### What Happens at Each Stage

| Stage | What | Where | Who does it |
|---|---|---|---|
| 1 | Developer writes code | Local PC | You |
| 2 | `git push origin dev` | Local → GitHub | You |
| 3 | Workflow triggers | GitHub | Automatic |
| 4 | Runner spins up | GitHub cloud | GitHub Actions |
| 5 | SSH into EC2 | Runner → EC2 | `appleboy/ssh-action` |
| 6 | Pull latest code | EC2 | `git pull` |
| 7 | Stop old containers | EC2 | `docker compose down` |
| 8 | Build new images & start containers | EC2 | `docker compose up -d --build` |
| 9 | App is live | EC2 | Docker (auto-restarts on crash) |

### PM2 vs Docker — Deployment Script Comparison

```bash
# OLD (PM2):
cd ~/CI-CD
git pull origin dev
npm run install-all
pm2 restart ecosystem.config.js

# NEW (Docker):
cd ~/CI-CD
git pull origin dev
docker compose down
docker compose up -d --build
```

**Why this is better:**
- No need to install Node.js or npm on the EC2 server itself
- No need to run `npm install` on the server — it happens inside the container during build
- No PM2 to install and configure
- Just Docker and your code — that's it

---

## 5. PM2 — Process Manager (Previous Approach)

> **Note:** We previously used PM2 to manage our Node.js apps directly on EC2. We've since moved to Docker for better isolation and portability. This section is kept for reference and interview prep.

### What is PM2?

PM2 is a **process manager** for Node.js applications. Think of it as a supervisor that:
- Keeps your app running 24/7
- Restarts it if it crashes
- Restarts it after server reboot
- Manages logs
- Monitors CPU and memory

### Why PM2? (vs other approaches)

| Approach | What happens when app crashes? | Runs in background? | Log management? |
|---|---|---|---|
| `node index.js` | App dies, stays dead | No (blocks terminal) | No |
| `nohup node index.js &` | App dies, stays dead | Yes | Basic (one file) |
| **PM2** | **Auto-restarts** | **Yes** | **Yes (per-app logs)** |
| `systemd` | Auto-restarts | Yes | Yes (journalctl) |
| Docker | Auto-restarts (with policy) | Yes | Yes |

### PM2 Lifecycle

```
pm2 start          pm2 restart         pm2 stop           pm2 delete
    │                   │                   │                   │
    ▼                   ▼                   ▼                   ▼
 ┌──────┐          ┌──────┐           ┌─────────┐        ┌──────────┐
 │online│ ◄──────► │online│           │ stopped │        │ removed  │
 └──────┘          └──────┘           └─────────┘        │ from PM2 │
    │                                      │              └──────────┘
    │ (app crashes)                        │
    ▼                                      │
 ┌──────────┐                              │
 │ errored  │──► auto-restart ──► online   │
 └──────────┘                              │
                                           │
              pm2 start all ◄──────────────┘
```

### PM2 Setup on EC2 (One-Time)

```bash
# 1. Install PM2 globally
sudo npm install -g pm2

# 2. Go to your project
cd ~/CI-CD

# 3. Start your apps using the ecosystem config
pm2 start ecosystem.config.js

# 4. Save the current process list (so PM2 remembers after reboot)
pm2 save

# 5. Generate startup script (makes PM2 start on server boot)
pm2 startup
# It will print a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
# COPY AND RUN THAT COMMAND
```

---

## 6. Ecosystem Config File (Previous Approach)

> **Note:** This config was used with PM2. With Docker, we use `Dockerfile` and `docker-compose.yml` instead.

### What is it?

A JavaScript file that tells PM2 **which apps to run** and **how to run them**.

### File: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'backend',              // Label in pm2 list
      script: 'index.js',           // File to run
      cwd: '/home/ec2-user/CI-CD/server',  // Working directory
      instances: 1,                 // Number of instances
      exec_mode: 'fork',           // fork (single) or cluster (multiple)
      env: {
        NODE_ENV: 'development'
      },
      max_memory_restart: '500M',  // Restart if memory exceeds 500MB
      restart_delay: 4000,         // Wait 4 sec before restarting after crash
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'frontend',
      script: 'node_modules/.bin/vite',  // On Linux, this works directly
      args: '--host 0.0.0.0',            // Allow external access
      cwd: '/home/ec2-user/CI-CD/client',
      // ... same options as above
    }
  ]
};
```

### Fork vs Cluster Mode

```
Fork Mode (instances: 1)           Cluster Mode (instances: 'max')
┌─────────────┐                    ┌─────────────┐
│   PM2       │                    │     PM2      │
│             │                    │   (master)   │
│  ┌───────┐  │                    │              │
│  │ App   │  │                    │ ┌──┐┌──┐┌──┐ │
│  │ (1x)  │  │                    │ │W1││W2││W3│ │
│  └───────┘  │                    │ └──┘└──┘└──┘ │
└─────────────┘                    └─────────────┘

Use for:                           Use for:
- Dev servers                      - Production APIs
- Vite/React                       - High traffic apps
- Small apps                       - CPU-intensive tasks
```

---

## 7. SSH Deployment Flow (Previous — PM2)

> **Note:** This was the PM2 deployment flow. See [Section 4](#4-docker-deployment-flow) for the current Docker-based flow.

```
┌──────────────┐    git push     ┌──────────────────┐
│  Developer   │ ──────────────► │     GitHub        │
│  (local PC)  │                 │   (repository)    │
└──────────────┘                 └────────┬─────────┘
                                          │
                                  push triggers
                                  GitHub Actions
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │  GitHub Runner    │
                                 │  (ubuntu-latest)  │
                                 │                   │
                                 │  Uses SSH to      │
                                 │  connect to EC2   │
                                 └────────┬─────────┘
                                          │
                                     SSH connection
                                    (using secrets)
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │    EC2 Server     │
                                 │                   │
                                 │  1. git pull      │
                                 │  2. npm install   │
                                 │  3. pm2 restart   │
                                 │                   │
                                 │  ┌────┐ ┌─────┐   │
                                 │  │API │ │Vite │   │
                                 │  │5000│ │5173 │   │
                                 │  └────┘ └─────┘   │
                                 └──────────────────┘
```

---

## 8. Common Commands Cheat Sheet

### Docker Commands

```bash
# --- Building & Running ---
docker compose up -d --build      # Build images and start containers (detached)
docker compose up -d              # Start containers (without rebuilding)
docker compose down               # Stop and remove containers
docker compose restart             # Restart all containers
docker compose stop                # Stop containers (don't remove)
docker compose start               # Start stopped containers

# --- Viewing Status ---
docker ps                          # Show running containers
docker ps -a                       # Show ALL containers (including stopped)
docker compose ps                  # Show containers for this project
docker images                      # List all images on this machine

# --- Logs ---
docker compose logs                # Show logs from all containers
docker compose logs backend        # Show logs from one container
docker compose logs -f             # Follow logs live (like tail -f)
docker compose logs --tail 50      # Last 50 lines

# --- Going Inside a Container ---
docker exec -it <container> sh     # Open a shell inside the container
docker exec -it backend sh         # Example: go inside backend container

# --- Cleanup ---
docker system prune                # Remove unused images, containers, networks
docker system prune -a             # Remove EVERYTHING unused (reclaim disk space)
docker rmi <image-id>              # Remove a specific image
docker rm <container-id>           # Remove a specific stopped container

# --- Building Images Manually ---
docker build -t my-backend ./server    # Build image from server/Dockerfile
docker run -p 5000:5000 my-backend     # Run the image as a container
```

### PM2 Commands (Previous)

```bash
# --- Starting & Stopping ---
pm2 start ecosystem.config.js     # Start all apps from config
pm2 stop all                      # Stop all apps
pm2 restart all                   # Restart all apps
pm2 delete all                    # Stop + remove all apps from PM2

# --- Monitoring ---
pm2 list                          # Show all running apps
pm2 monit                         # Real-time dashboard
pm2 logs                          # Live logs from all apps
pm2 logs --lines 50               # Last 50 lines
```

### GitHub CLI Commands (useful for debugging)

```bash
# Check workflow runs
gh run list

# Watch a running workflow
gh run watch

# View workflow run logs
gh run view <run-id> --log
```

### EC2 Useful Commands

```bash
# Check what's running on a port
sudo lsof -i :5000
sudo fuser 5000/tcp

# Kill process on a port
sudo fuser -k 5000/tcp

# Check system resources
htop
free -m
df -h

# Check Docker disk usage
docker system df
```

---

## 9. Interview Questions & Answers

### CI/CD Basics

**Q1: What is CI/CD? Explain in simple terms.**

> **CI (Continuous Integration)** means every time a developer pushes code, it's automatically tested and validated. **CD (Continuous Deployment)** means if the tests pass, the code is automatically deployed to the server. Together, they eliminate manual work and reduce human errors in the deployment process.

---

**Q2: What is the difference between Continuous Delivery and Continuous Deployment?**

> **Continuous Delivery:** Code is automatically tested and prepared for release, but a human manually approves the deployment.
> **Continuous Deployment:** Code is automatically deployed to production with no manual approval. Every passing commit goes live.

---

**Q3: What are the benefits of CI/CD?**

> - Faster releases (deploy multiple times a day)
> - Fewer bugs (automated testing catches issues early)
> - Consistent deployments (same steps every time)
> - Quick rollbacks (easy to revert if something breaks)
> - Developer productivity (no manual deployment tasks)

---

### GitHub Actions

**Q4: What is GitHub Actions?**

> GitHub Actions is a CI/CD platform built into GitHub. It lets you automate workflows — like testing, building, and deploying code — triggered by events like pushes, pull requests, or schedules. Workflows are defined in YAML files inside `.github/workflows/`.

---

**Q5: What is the difference between a Job and a Step in GitHub Actions?**

> A **Job** is a set of steps that run on the same runner (virtual machine). A **Step** is a single task within a job (like running a command or using an action). Jobs run in parallel by default; steps within a job run sequentially.

---

**Q6: What are GitHub Secrets and why are they important?**

> GitHub Secrets are encrypted environment variables stored at the repository or organization level. They are used to store sensitive information like API keys, SSH keys, and passwords. Secrets are never exposed in logs and can only be accessed within workflows. This prevents hardcoding credentials in code, which would be a security risk.

---

**Q7: How do you trigger a workflow only on a specific branch?**

> ```yaml
> on:
>   push:
>     branches:
>       - main
>       - dev
> ```
> This ensures the workflow only runs when code is pushed to `main` or `dev`, not feature branches.

---

**Q8: What is `actions/checkout@v4` and why is it needed?**

> It's a GitHub-provided action that downloads your repository code onto the runner. Without it, the runner has no access to your code. The `@v4` refers to version 4 of this action.

---

**Q9: What does `runs-on: ubuntu-latest` mean?**

> It specifies the operating system of the virtual machine (runner) where the job executes. `ubuntu-latest` gives you the most recent Ubuntu version provided by GitHub. Other options include `windows-latest` and `macos-latest`.

---

**Q10: How do you pass secrets to a workflow step?**

> Using the `${{ secrets.SECRET_NAME }}` syntax:
> ```yaml
> with:
>   host: ${{ secrets.EC2_HOST }}
> ```
> GitHub replaces this with the actual secret value at runtime. The value is masked in logs.

---

### Docker

**Q11: What is Docker and why is it used?**

> Docker is a containerization platform that packages applications and all their dependencies into isolated units called **containers**. It's used to:
> - Eliminate "works on my machine" problems
> - Ensure identical environments across dev, staging, and production
> - Isolate apps from each other (no dependency conflicts)
> - Simplify deployment (just run `docker compose up`)
> - Make scaling easier (from single server to orchestration platforms)

---

**Q12: What is the difference between a Docker Image and a Container?**

> A **Docker Image** is a read-only blueprint — it contains your code, dependencies, and OS layer. Think of it like a class in OOP.
> A **Container** is a running instance of an image — it's the actual process executing your app. Think of it like an object (instance of a class).
> You can create many containers from one image.
> ```
> Image (blueprint)  →  Container 1 (running)
>                    →  Container 2 (running)
>                    →  Container 3 (running)
> ```

---

**Q13: What is a Dockerfile?**

> A Dockerfile is a text file with step-by-step instructions to build a Docker image. Each instruction creates a layer in the image. Common instructions include `FROM` (base image), `COPY` (add files), `RUN` (execute commands), `EXPOSE` (declare ports), and `CMD` (startup command).

---

**Q14: What is Docker Compose and when do you use it?**

> Docker Compose is a tool for defining and running **multi-container** applications. You describe all your services (backend, frontend, database, etc.) in a single `docker-compose.yml` file and start everything with one command: `docker compose up`. Use it when your app has more than one container that need to work together.

---

**Q15: Explain the purpose of each Dockerfile instruction: FROM, WORKDIR, COPY, RUN, EXPOSE, CMD.**

> | Instruction | Purpose |
> |---|---|
> | `FROM` | Sets the base image (e.g., `node:18-alpine`) — the starting point |
> | `WORKDIR` | Sets the working directory inside the container |
> | `COPY` | Copies files from your computer into the container |
> | `RUN` | Executes a command during image build (e.g., `npm install`) |
> | `EXPOSE` | Documents which port the container listens on (informational only) |
> | `CMD` | The command that runs when the container starts |

---

**Q16: Why do we copy `package.json` before copying the rest of the code in a Dockerfile?**

> For **layer caching**. Docker caches each layer. If `package.json` hasn't changed, Docker reuses the cached `npm install` layer instead of reinstalling everything. If we did `COPY . .` first, any code change would invalidate the cache and force a full reinstall.
> ```dockerfile
> # GOOD — npm install only reruns when packages change
> COPY package*.json ./
> RUN npm ci
> COPY . .
>
> # BAD — npm install reruns on ANY code change
> COPY . .
> RUN npm ci
> ```

---

**Q17: What is `.dockerignore` and why is it important?**

> `.dockerignore` tells Docker which files to exclude when copying files into the image. It keeps images small and prevents sensitive files (like `.env`) from being baked into the image. Common exclusions: `node_modules`, `.git`, `.env`, `*.md`.

---

**Q18: What is the difference between `CMD` and `ENTRYPOINT` in a Dockerfile?**

> **`CMD`** sets the default command but can be overridden at runtime: `docker run myimage <new-command>`.
> **`ENTRYPOINT`** sets a fixed command that always runs — arguments passed at runtime are appended to it.
> ```dockerfile
> # CMD — can be replaced entirely
> CMD ["node", "index.js"]
> # docker run myimage sh   → runs sh (CMD replaced)
>
> # ENTRYPOINT — always runs
> ENTRYPOINT ["node"]
> CMD ["index.js"]
> # docker run myimage app.js  → runs node app.js (ENTRYPOINT kept, CMD replaced)
> ```

---

**Q19: What are Docker restart policies? Which one should you use in production?**

> Restart policies control what happens when a container stops:
> - `no` — never restart
> - `always` — restart no matter what (even after `docker stop`)
> - `unless-stopped` — restart always EXCEPT when manually stopped **(best for production)**
> - `on-failure` — only restart if the container exited with an error

---

**Q20: How do you view logs of a Docker container?**

> ```bash
> docker compose logs              # All containers
> docker compose logs backend      # Specific service
> docker compose logs -f           # Follow live (stream)
> docker compose logs --tail 100   # Last 100 lines
> docker logs <container-id>       # By container ID
> ```

---

### PM2 (Previous Approach)

**Q21: What is PM2 and why was it used?**

> PM2 is a production process manager for Node.js applications. It's used to:
> - Keep apps running 24/7 (auto-restart on crash)
> - Manage multiple apps from a single tool
> - Handle logs with timestamps
> - Monitor CPU and memory usage
> - Survive server reboots (`pm2 startup`)
>
> We moved to Docker because it provides full isolation, eliminates environment drift, and makes the setup portable.

---

**Q22: What is the difference between `fork` and `cluster` mode in PM2?**

> **Fork mode:** Runs a single instance of the app. Used for most apps, especially dev servers.
> **Cluster mode:** Runs multiple instances across CPU cores, sharing the same port. Used for production APIs to handle more traffic. Only works with stateless apps.

---

**Q23: What is an ecosystem file in PM2?**

> An ecosystem file (`ecosystem.config.js`) is a configuration file that defines all apps PM2 should manage. It specifies the script to run, working directory, environment variables, log paths, memory limits, and restart behavior.

---

### Deployment & SSH

**Q24: What is `appleboy/ssh-action` in GitHub Actions?**

> It's a third-party GitHub Action that SSHs into a remote server and runs commands. It uses your SSH key (stored as a GitHub Secret) to authenticate. It's commonly used to deploy code to EC2 or any Linux server.

---

**Q25: Describe your deployment pipeline end-to-end.**

> 1. Developer pushes code to the `dev` branch
> 2. GitHub Actions workflow triggers automatically
> 3. A GitHub runner (Ubuntu VM) spins up
> 4. The runner SSHs into our EC2 server using secrets
> 5. On EC2: `git pull` to get latest code
> 6. `docker compose down` to stop old containers
> 7. `docker compose up -d --build` to build new images and start containers
> 8. Docker runs the backend (port 5000) and frontend (port 5173) in isolated containers
> 9. If a container crashes, Docker auto-restarts it (`unless-stopped` policy)

---

### Scenario-Based Questions

**Q26: Your deployment workflow runs but the app doesn't start. How do you debug?**

> 1. Check GitHub Actions logs (Actions tab → click the failed run)
> 2. SSH into the server and check containers: `docker ps -a`
> 3. Check container logs: `docker compose logs`
> 4. Check if the image built successfully: `docker images`
> 5. Check if ports are in use: `sudo lsof -i :5000`
> 6. Try building manually: `docker compose up --build` (without `-d` to see output)

---

**Q27: Your container keeps restarting. How do you investigate?**

> 1. `docker compose logs backend --tail 100` — check error messages
> 2. `docker ps -a` — check restart count and exit codes
> 3. `docker inspect <container>` — check detailed state and config
> 4. Check if `.env` file exists and has correct values
> 5. Check if the database (RDS) is reachable from the container
> 6. Go inside the container: `docker exec -it backend sh` — look around

---

**Q28: You push to `dev` but the workflow doesn't trigger. What could be wrong?**

> 1. Check if the workflow file is in `.github/workflows/` (exact path matters)
> 2. Check if the branch name matches: `branches: [dev]`
> 3. Check if the YAML syntax is valid (indentation matters)
> 4. Check GitHub → Actions tab → is Actions enabled for the repo?
> 5. Check if you pushed to the correct branch: `git branch`

---

**Q29: How would you set up different deployments for `dev` and `prod` branches?**

> Create two workflow files:
> - `.github/workflows/deploy-dev.yml` → triggers on push to `dev` → deploys to dev server
> - `.github/workflows/deploy-prod.yml` → triggers on push to `prod` → deploys to production server
>
> Use different GitHub Secrets for each:
> - `DEV_EC2_HOST` / `PROD_EC2_HOST`
> - `DEV_EC2_SSH_KEY` / `PROD_EC2_SSH_KEY`

---

**Q30: What happens if two developers push to `dev` at the same time?**

> GitHub Actions queues the workflows. The first push triggers a workflow run, and the second push triggers another. They run sequentially (by default) for the same branch. You can configure concurrency to cancel the older run:
> ```yaml
> concurrency:
>   group: deploy-dev
>   cancel-in-progress: true
> ```
> This cancels the first deployment and only deploys the latest code.

---

### Quick Comparison Table (for revision)

| Tool | What | When | Why |
|---|---|---|---|
| GitHub Actions | CI/CD automation | On every push/PR | Automate testing and deployment |
| GitHub Secrets | Encrypted variables | Store sensitive data | Keep SSH keys and passwords safe |
| SSH Action | Remote server access | During deployment | Run commands on EC2 from GitHub |
| Docker | Containerization | Package and run apps | Identical environments everywhere |
| Docker Compose | Multi-container orchestration | Run multiple services | Start backend + frontend with one command |
| Dockerfile | Image blueprint | Build container images | Reproducible, layer-cached builds |
| `.dockerignore` | Exclude files from image | During `docker build` | Keep images small, exclude secrets |
| PM2 (previous) | Process manager | On the server | Keep Node.js apps alive (replaced by Docker) |
