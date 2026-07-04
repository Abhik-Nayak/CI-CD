# ──────────────────────────────────────────────
# Stage 1 — Build React app
# ──────────────────────────────────────────────

FROM node:22-alpine AS builder

WORKDIR /app

# Dependencies first — cached layer, only re-runs when package files change
COPY package*.json ./
RUN npm ci

# VITE_API_URL is baked into the JS bundle at build time — not runtime.
# ARG receives the value from --build-arg at docker build time.
# ENV makes it available to the npm run build process so Vite can read it.
# Default is /api/todos — nginx proxies /api to the backend container.
ARG VITE_API_URL=/api/todos
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2 — Serve with nginx
# ──────────────────────────────────────────────

# nginx:alpine = ~40MB, production-grade static file server
FROM nginx:alpine

# Copy React build output into nginx's default html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default nginx config with ours (SPA routing + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# reverse proxy — serves React + forwards /api to Express
EXPOSE 80

# "daemon off" keeps nginx in the foreground so Docker can track the process
CMD ["nginx", "-g", "daemon off;"]
