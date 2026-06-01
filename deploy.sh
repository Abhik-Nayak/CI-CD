#!/bin/bash
# This script runs ON the EC2 instance during deployment.
# GitHub Actions will SSH into EC2 and execute this.

set -e

APP_DIR=~/pern-app

echo "==> Navigating to app directory..."
cd $APP_DIR

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building and starting containers in production mode..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "==> Cleaning up old Docker images..."
docker image prune -f

echo "==> Waiting for app to start..."
sleep 5

echo "==> Checking if app is running..."
if curl -s http://localhost/api/health | grep -q "ok"; then
  echo "==> Deployment SUCCESS! App is running."
else
  echo "==> WARNING: Health check failed. Check logs with: docker-compose -f docker-compose.prod.yml logs"
  exit 1
fi
