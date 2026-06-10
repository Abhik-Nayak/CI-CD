# ──────────────────────────────────────────────
# Stage 1 — install dependencies
# ──────────────────────────────────────────────

# node:22-alpine = Node 22 on Alpine Linux (~180MB total vs ~1GB for Debian)
FROM node:22-alpine AS deps

WORKDIR /app

# Copy lockfile + manifest before source code.
# Docker builds in layers — this layer is cached until package*.json changes,
# so npm ci only re-runs when you add/remove a package, not on every code edit.
COPY package*.json ./

# npm ci = strict reproducible install from package-lock.json (never resolves differently)
# --omit=dev = skip nodemon, eslint, and other devDependencies — not needed in production
RUN npm ci --omit=dev

# ──────────────────────────────────────────────
# Stage 2 — production image
# ──────────────────────────────────────────────

FROM node:22-alpine

WORKDIR /app

# Security: run as a non-root user.
# By default containers run as root — if the app is exploited, attacker gets root.
# "node" is a built-in non-root user that ships with the node image.
USER node

# Copy the clean production node_modules from the deps stage (no devDependencies)
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy application source code (node_modules excluded via .dockerignore)
COPY --chown=node:node . .

# Tell Docker this container listens on 5000 — informational only.
# Actual port binding is done at: docker run -p 5000:5000
EXPOSE 5000

# NODE_ENV=production tells Express to enable production optimisations
# (e.g. error handling, caching headers). Also respected by many npm packages.
ENV NODE_ENV=production

# Use exec form ["node", "..."] not shell form ("node ...").
# Exec form makes node PID 1 — it receives OS signals (SIGTERM) directly,
# so docker stop does a graceful shutdown instead of a hard kill after 10s.
CMD ["node", "index.js"]
