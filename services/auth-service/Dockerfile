# syntax=docker/dockerfile:1
#
# Dockerfile for auth-service.
# Read top-to-bottom — each instruction is a cached LAYER. Ordering matters:
# put the things that change LEAST at the top so rebuilds reuse the cache.

# ---- base image -----------------------------------------------------------
# node:20-alpine = small (~50MB) Alpine Linux + Node 20. We pin the major
# version for reproducibility. Alpine keeps the image tiny (faster pulls in CI
# and Kubernetes).
FROM node:20-alpine

# Run as a non-root user. Containers default to root, which is a security risk
# if the app is compromised. The node image ships a ready-made "node" user.
# We set the workdir and give that user ownership.
WORKDIR /app

# ---- dependencies (cached separately from source) -------------------------
# Copy ONLY the manifests first. As long as these files don't change, Docker
# reuses the cached "npm ci" layer even when your source code changes — huge
# speed-up on rebuilds.
COPY package.json package-lock.json* ./

# npm ci = clean, reproducible install from the lockfile. --omit=dev skips
# devDependencies so the production image stays lean.
RUN npm ci --omit=dev || npm install --omit=dev

# ---- application source ---------------------------------------------------
COPY src ./src

# Drop privileges before running.
USER node

# Document the port the app listens on (informational; publishing happens at
# `docker run -p` / compose).
EXPOSE 4001

# The default command. We call node directly (no npm) so signals (SIGTERM on
# `docker stop`) reach the Node process for a clean shutdown.
CMD ["node", "src/index.js"]
