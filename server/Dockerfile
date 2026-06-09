# Use Node.js 18 on Alpine Linux (small ~50MB base image)
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first (for Docker layer caching)
# If these files don't change, npm ci won't re-run on next build
COPY package.json package-lock.json ./

# Install production dependencies only (skip nodemon etc.)
RUN npm ci --only=production

# Copy the rest of the server code
COPY . .

# Document which port the app listens on
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]
