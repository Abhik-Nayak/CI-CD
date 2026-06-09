# ========== Stage 1: Build React app ==========
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first (layer caching)
COPY package.json package-lock.json ./

# Install dependencies (need devDependencies for Vite build)
RUN npm ci

# Copy source code
COPY . .

# Build React → outputs to /app/dist
RUN npm run build

# ========== Stage 2: Serve with Nginx ==========
FROM nginx:alpine

# Remove default Nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy our Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React files from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
