# DevOps Notes — CI/CD, GitHub Actions, PM2

---

## Table of Contents

1. [CI/CD — The Big Picture](#1-cicd--the-big-picture)
2. [GitHub Actions Workflow](#2-github-actions-workflow)
3. [PM2 — Process Manager](#3-pm2--process-manager)
4. [Ecosystem Config File](#4-ecosystem-config-file)
5. [SSH Deployment Flow](#5-ssh-deployment-flow)
6. [Common Commands Cheat Sheet](#6-common-commands-cheat-sheet)
7. [Interview Questions & Answers](#7-interview-questions--answers)

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
| App crashes, nobody notices | PM2 auto-restarts the app |
| "It works on my machine" | Same steps run every time |

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
            npm run install-all
            pm2 restart ecosystem.config.js
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
  → npm install (install dependencies)
  → pm2 restart (restart the app)
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

## 3. PM2 — Process Manager

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

### When to use PM2?

- Running Node.js apps on a Linux server (EC2, DigitalOcean, etc.)
- You need auto-restart on crash
- You want easy log management
- You're managing multiple Node.js apps on one server
- You don't want the complexity of Docker yet

### When NOT to use PM2?

- Local development (use `npm run dev` instead)
- Dockerized apps (Docker handles restarts itself)
- Non-Node.js apps (use `systemd` or `supervisor`)

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

## 4. Ecosystem Config File

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

### Every Field Explained

| Field | What it does | Example |
|---|---|---|
| `name` | App label in PM2 dashboard | `'backend'` |
| `script` | The file PM2 runs | `'index.js'` |
| `cwd` | Directory to run from | `'/home/ec2-user/CI-CD/server'` |
| `args` | Arguments passed to the script | `'--host 0.0.0.0'` |
| `instances` | How many copies to run | `1` or `'max'` (all CPU cores) |
| `exec_mode` | `'fork'` (single) or `'cluster'` (multi-core) | `'fork'` |
| `env` | Environment variables | `{ NODE_ENV: 'development' }` |
| `max_memory_restart` | Auto-restart if memory exceeds this | `'500M'` |
| `restart_delay` | Delay (ms) before restarting after crash | `4000` |
| `error_file` | Where stderr logs are written | `'./logs/error.log'` |
| `out_file` | Where stdout logs are written | `'./logs/out.log'` |
| `log_date_format` | Timestamp format for log lines | `'YYYY-MM-DD HH:mm:ss Z'` |
| `watch` | Auto-restart on file change | `false` (use for dev only) |
| `ignore_watch` | Folders to ignore if watch is true | `['node_modules', '.git']` |

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

### Windows vs Linux Gotcha

```
Windows:  node_modules/.bin/vite     → This is a .cmd file → PM2 FAILS
          node_modules/vite/bin/vite.js  → Actual JS file → PM2 WORKS

Linux:    node_modules/.bin/vite     → This is a shell script → PM2 WORKS
```

---

## 5. SSH Deployment Flow

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

### What Happens at Each Stage

| Stage | What | Where | Who does it |
|---|---|---|---|
| 1 | Developer writes code | Local PC | You |
| 2 | `git push origin dev` | Local → GitHub | You |
| 3 | Workflow triggers | GitHub | Automatic |
| 4 | Runner spins up | GitHub cloud | GitHub Actions |
| 5 | SSH into EC2 | Runner → EC2 | `appleboy/ssh-action` |
| 6 | Pull latest code | EC2 | `git pull` |
| 7 | Install dependencies | EC2 | `npm run install-all` |
| 8 | Restart app | EC2 | `pm2 restart` |
| 9 | App is live | EC2 | PM2 |

---

## 6. Common Commands Cheat Sheet

### PM2 Commands

```bash
# --- Starting & Stopping ---
pm2 start ecosystem.config.js     # Start all apps from config
pm2 start app.js                  # Start a single file
pm2 stop all                      # Stop all apps
pm2 stop backend                  # Stop one app by name
pm2 restart all                   # Restart all apps
pm2 restart backend               # Restart one app
pm2 reload all                    # Zero-downtime restart (cluster mode only)
pm2 delete all                    # Stop + remove all apps from PM2

# --- Monitoring ---
pm2 list                          # Show all running apps
pm2 monit                         # Real-time dashboard (CPU, memory, logs)
pm2 show backend                  # Detailed info about one app

# --- Logs ---
pm2 logs                          # Live logs from all apps
pm2 logs backend                  # Live logs from one app
pm2 logs --lines 50               # Last 50 lines
pm2 flush                         # Clear all log files

# --- Startup ---
pm2 save                          # Save current app list
pm2 startup                       # Generate boot startup script
pm2 unstartup                     # Remove boot startup script
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
```

---

## 7. Interview Questions & Answers

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

### PM2

**Q11: What is PM2 and why is it used?**

> PM2 is a production process manager for Node.js applications. It's used to:
> - Keep apps running 24/7 (auto-restart on crash)
> - Manage multiple apps from a single tool
> - Handle logs with timestamps
> - Monitor CPU and memory usage
> - Survive server reboots (`pm2 startup`)

---

**Q12: What is the difference between `fork` and `cluster` mode in PM2?**

> **Fork mode:** Runs a single instance of the app. Used for most apps, especially dev servers.
> **Cluster mode:** Runs multiple instances across CPU cores, sharing the same port. Used for production APIs to handle more traffic. Only works with stateless apps.
> ```javascript
> // Fork — 1 instance
> { instances: 1, exec_mode: 'fork' }
> // Cluster — use all CPU cores
> { instances: 'max', exec_mode: 'cluster' }
> ```

---

**Q13: What is an ecosystem file in PM2?**

> An ecosystem file (`ecosystem.config.js`) is a configuration file that defines all apps PM2 should manage. It specifies the script to run, working directory, environment variables, log paths, memory limits, and restart behavior. Instead of passing all options via command line, you define them once in this file.

---

**Q14: How do you ensure PM2 restarts apps after a server reboot?**

> Two commands:
> ```bash
> pm2 save       # Saves the current list of running apps
> pm2 startup    # Generates a system startup script
> ```
> `pm2 startup` outputs a command (usually involving `systemd`) that you must copy and run. After this, PM2 and all saved apps start automatically when the server boots.

---

**Q15: What is the difference between `pm2 restart` and `pm2 reload`?**

> **`pm2 restart`:** Kills the app and starts it fresh. There's a brief downtime.
> **`pm2 reload`:** Only works in cluster mode. It restarts instances one by one, so at least one instance is always running. This achieves **zero-downtime** deployment.

---

**Q16: How do you view logs in PM2?**

> ```bash
> pm2 logs                # All apps, live stream
> pm2 logs backend        # Specific app
> pm2 logs --lines 100    # Last 100 lines
> pm2 flush               # Clear all logs
> ```
> Logs are stored in `~/.pm2/logs/` by default, or in custom paths defined in the ecosystem file.

---

### Deployment & SSH

**Q17: What is `appleboy/ssh-action` in GitHub Actions?**

> It's a third-party GitHub Action that SSHs into a remote server and runs commands. It uses your SSH key (stored as a GitHub Secret) to authenticate. It's commonly used to deploy code to EC2 or any Linux server.

---

**Q18: Why use `nohup` when running apps via SSH?**

> When an SSH session ends, all processes started in that session are killed. `nohup` (no hang up) prevents this — the app keeps running after SSH disconnects. The `&` at the end runs it in the background so the SSH session can exit.
> ```bash
> nohup npm run dev > app.log 2>&1 &
> ```
> However, PM2 is a better alternative because it also handles crash recovery and log management.

---

**Q19: Why shouldn't you use `pkill -f "node"` to stop your app?**

> `pkill -f "node"` kills ALL processes with "node" in the name, including system processes you don't own. This can cause `Operation not permitted` errors or accidentally kill other apps. Instead, use:
> - `pm2 restart all` (if using PM2)
> - `fuser -k 5000/tcp` (kill by specific port)

---

**Q20: What is the difference between running `npm run dev` vs `npm run start` on a server?**

> **`npm run dev`** (uses `nodemon`): Watches for file changes and auto-restarts. Good for local development, but unnecessary on a server since PM2 handles restarts.
> **`npm run start`** (uses `node`): Runs the app directly without watching. Lighter on resources. This is what you should use in production with PM2.

---

### Scenario-Based Questions

**Q21: Your deployment workflow runs but the app doesn't start. How do you debug?**

> 1. Check GitHub Actions logs (Actions tab → click the failed run)
> 2. SSH into the server and check PM2 status: `pm2 list`
> 3. Check app logs: `pm2 logs`
> 4. Check if ports are in use: `sudo lsof -i :5000`
> 5. Check if dependencies installed: `cd server && npm install`
> 6. Try running the app manually: `node index.js`

---

**Q22: Your app keeps crashing and restarting on EC2. How do you investigate?**

> 1. `pm2 logs backend --lines 100` — check error messages
> 2. `pm2 show backend` — check restart count and memory usage
> 3. Check if it's a memory issue (hitting `max_memory_restart`)
> 4. Check `.env` file — missing environment variables cause crashes
> 5. Check database connection — is PostgreSQL running?
> 6. Run `pm2 monit` to watch CPU/memory in real-time

---

**Q23: You push to `dev` but the workflow doesn't trigger. What could be wrong?**

> 1. Check if the workflow file is in `.github/workflows/` (exact path matters)
> 2. Check if the branch name matches: `branches: [dev]`
> 3. Check if the YAML syntax is valid (indentation matters)
> 4. Check GitHub → Actions tab → is Actions enabled for the repo?
> 5. Check if you pushed to the correct branch: `git branch`

---

**Q24: How would you set up different deployments for `dev` and `prod` branches?**

> Create two workflow files:
> - `.github/workflows/deploy-dev.yml` → triggers on push to `dev` → deploys to dev server
> - `.github/workflows/deploy-prod.yml` → triggers on push to `prod` → deploys to production server
>
> Use different GitHub Secrets for each:
> - `DEV_EC2_HOST` / `PROD_EC2_HOST`
> - `DEV_EC2_SSH_KEY` / `PROD_EC2_SSH_KEY`

---

**Q25: What happens if two developers push to `dev` at the same time?**

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
| PM2 | Process manager | On the server | Keep Node.js apps alive 24/7 |
| Ecosystem file | PM2 config | Define app settings | Manage multiple apps from one file |
| `nohup` | Keep process alive | SSH deployment (without PM2) | Prevent app from dying when SSH ends |
| `fuser -k` | Kill process by port | Before restarting app | Free up the port for the new process |
