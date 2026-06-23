# Dedicated API gateway — just nginx with a routing config.
# No build step: it owns no code, only the routing rules.
FROM nginx:alpine

# Replace the default site with our gateway routing config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The gateway is the single backend entry point on port 80 (internal network).
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
