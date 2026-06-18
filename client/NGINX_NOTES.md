# nginx Notes

## What is nginx?
- A web server that sits between the browser and your app
- Does 3 jobs: serve static files, reverse proxy, forward proxy

---

## Forward Proxy vs Reverse Proxy

| | Forward Proxy | Reverse Proxy |
|---|---|---|
| Sits in front of | Client | Server |
| Client knows? | Yes | No |
| Server knows real client? | No | No |
| Destination | Dynamic (whatever client wants) | Hardcoded (your backend) |
| Used for | VPNs, hiding client IP, content filtering | Routing, hiding backend, load balancing |

---

## Diagrams

### Reverse Proxy (port 80)
```
                       nginx (port 80)
                      ┌──────────────────────────────┐
Browser ── port 80 ──▶│  /      → serve React files  │
                      │  /api   → forward to :5000   │──▶ Express (port 5000)
                      └──────────────────────────────┘
                        server (Express) is HIDDEN
                        browser never sees port 5000
```

### Forward Proxy (port 8080)
```
                       nginx (port 8080)
                      ┌──────────────────────────────┐
Browser ── port 8080 ▶│  /   → forward to $host      │──▶ google.com
(proxy set in browser)│        (dynamic destination) │──▶ youtube.com
                      └──────────────────────────────┘
                        client IP is HIDDEN
                        websites see nginx's IP
```

---

## nginx.conf — Point by Point

### Reverse Proxy Block (port 80)

- `listen 80` — accepts all incoming traffic on port 80
- `root /usr/share/nginx/html` — where React build files live
- `index index.html` — default file to serve

**location /**
- serves static React files (HTML, CSS, JS)
- `try_files $uri $uri/ /index.html` — if file not found, serve index.html
- needed because React Router handles routes inside the browser (SPA)

**location /api**
- any request starting with `/api` is forwarded to `http://server:5000`
- `server` = Docker Compose service name, Docker DNS resolves it
- browser never touches port 5000 directly
- headers passed to Express:
  - `X-Real-IP` — real browser IP
  - `X-Forwarded-For` — full chain of IPs
  - `X-Forwarded-Proto` — http or https?

### Forward Proxy Block (port 8080)

- `listen 8080` — separate port from reverse proxy
- `resolver 8.8.8.8` — Google DNS, needed to resolve dynamic hostnames
- `proxy_pass $scheme://$host$request_uri` — destination is dynamic, decided by client
  - `$scheme` = http or https
  - `$host` = destination domain (e.g. google.com)
  - `$request_uri` = path + query string

---

## Key Difference — One Line

- **Reverse proxy** → destination is **hardcoded** (`http://server:5000`)
- **Forward proxy** → destination is **dynamic** (`$scheme://$host$request_uri`)

---

## To activate Forward Proxy

1. Expose port 8080 in docker-compose.yml:
```yaml
client:
    ports:
      - "80:80"
      - "8080:8080"
```

2. Set your browser proxy settings to `localhost:8080`

---

## Does your app need Forward Proxy?

No. It is added here for learning purposes only.
Forward proxy is useful for: corporate networks, VPNs, content filtering.
Your todo app only needs the reverse proxy on port 80.
