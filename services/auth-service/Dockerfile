# ──────────────────────────────────────────────
# Stage 1 — install dependencies
# ──────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# ──────────────────────────────────────────────
# Stage 2 — production image
# ──────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

EXPOSE 5002

ENV NODE_ENV=production

CMD ["node", "index.js"]
