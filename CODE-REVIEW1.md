# Code Review — Performance & Security Improvements

> Last updated: 2026-06-05
> Reviewed by: Abhik Nayak

---

## Progress Tracker

| # | Issue | Impact | Difficulty | Status |
|---|---|---|---|---|
| 1 | Vite dev server in production | Huge | Medium | Done |
| 2 | No compression middleware | High | Easy | Done |
| 3 | No helmet security headers | High | Easy | Done |
| 4 | CORS allows all origins | Medium | Easy | Pending |
| 5 | Full refetch after every mutation | Medium | Easy | Done |
| 6 | No loading/error states in UI | Medium | Easy | Done |
| 7 | No database index on `created_at` | Medium | Easy | Pending |
| 8 | No rate limiting | Medium | Easy | Done |
| 9 | `err.message` exposed to client | Low | Easy | Done |

---

## 1. Vite Dev Server in Production — DONE

**Problem:**
EC2 was running `vite --host 0.0.0.0` (a development server) to serve the React frontend. This is 5-10x slower than serving built static files and uses ~132MB of RAM unnecessarily.

**What was changed:**
- `client/vite.config.js` — Build output now goes to `server/public/`
- `server/index.js` — Added `express.static` to serve React built files from Express
- `ecosystem.config.js` — Removed the frontend PM2 process (only backend needed now)
- `deploy-dev.yml` — Added `npm run build` step before PM2 restart
- `.gitignore` — Added `server/public` (build output)
- Health check moved from `/` to `/api/health`

**Result:**
- PM2 processes: 2 → 1
- Memory usage: ~187MB → ~55MB
- Frontend bundle: raw source → 60KB gzipped
- Port 5173 no longer needed — everything on port 5000

---

## 2. No Compression Middleware — DONE

**Problem:**
Express sends raw uncompressed JSON and HTML. Every API response and static file is sent at full size over the network, making the app 60-70% slower on slow connections.

**What was changed:**
- Installed `compression` package
- Added `app.use(compression())` in `server/index.js` before all other middleware

**Files changed:** `server/index.js`, `package.json`

---

## 3. No Helmet Security Headers — DONE

**Problem:**
Express doesn't set security HTTP headers. Missing headers like `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` leave the app vulnerable to common attacks (clickjacking, MIME sniffing, etc).

**What was changed:**
- Installed `helmet` package
- Added `app.use(helmet())` in `server/index.js` after compression, before cors

**Files changed:** `server/index.js`, `package.json`

---

## 4. CORS Allows All Origins — PENDING

**Problem:**
`app.use(cors())` with no options allows ANY website to call your API. A malicious site could make requests to your backend from a user's browser.

**What to do:**
- Restrict CORS to only your frontend URLs:
```javascript
app.use(cors({
  origin: [
    "http://localhost:5173",          // Local dev
    "http://<EC2-IP>:5000"            // Production
  ]
}));
```

**Files to change:** `server/index.js`

---

## 5. Full Refetch After Every Mutation — DONE

**Problem:**
Every `addTodo`, `updateTodo`, `deleteTodo` calls `fetchTodos()` which reloads ALL todos from the database. With 100 todos, checking one checkbox fetches all 100 rows again.

**What was changed:**
- `addTodo` — reads the new todo from the API response and prepends it to local state
- `updateTodo` — reads the updated todo from the API response and replaces it in local state by id
- `deleteTodo` — filters the deleted todo out of local state by id
- Each mutation now makes 1 API call instead of 2

**Files changed:** `client/src/App.jsx`

---

## 6. No Loading/Error States in UI — DONE

**Problem:**
If the API is slow or fails, the user sees a blank screen with no feedback. No spinner, no error message.

**What was changed:**
- Added `loading` and `error` state variables
- `fetchTodos` wrapped in try/catch with loading/error handling
- All mutations (`addTodo`, `updateTodo`, `deleteTodo`) wrapped in try/catch with error handling
- UI shows "Loading todos..." text during initial fetch
- Dismissable red error banner appears when any operation fails
- Added `.loading`, `.error-banner`, `.dismiss-btn` CSS styles

**Files changed:** `client/src/App.jsx`, `client/src/App.css`

---

## 7. No Database Index on `created_at` — PENDING

**Problem:**
`SELECT * FROM todos ORDER BY created_at DESC` does a full table scan. With thousands of rows, this query gets progressively slower because PostgreSQL has to sort all rows every time.

**What to do:**
Add an index in `server/index.js` (inside the `start()` function):
```sql
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);
```

**Files to change:** `server/index.js`

---

## 8. No Rate Limiting — DONE

**Problem:**
Anyone can spam your API with unlimited requests. A simple script could send 10,000 requests per second and crash your server or fill your database.

**What was changed:**
- Installed `express-rate-limit` package
- Added rate limiter middleware on all `/api` routes: 100 requests per 15-minute window per IP
- Uses `standardHeaders: true` (sends `RateLimit-*` headers) and `legacyHeaders: false`
- Clients exceeding the limit receive `429 Too Many Requests`

**Files changed:** `server/index.js`, `package.json`

---

## 9. `err.message` Exposed to Client — DONE

**Problem:**
When a 500 error occurs, the raw error message is sent to the client:
```javascript
res.status(500).json({ error: err.message });
```
This can leak internal details like database table names, column names, or connection strings.

**What was changed:**
- All 5 catch blocks in `server/routes/todos.js` now log the full error with `console.error(err)` and return a generic `"Internal server error"` message to the client

**Files changed:** `server/routes/todos.js`

---

## How to Use This Document

1. Pick a pending item
2. Create a feature branch: `git checkout -b fix/item-number-description`
3. Apply the changes
4. Test locally
5. Update the status in this file from `Pending` to `Done`
6. Add a summary of what was changed (like item #1)
7. Push and create a PR to `dev`
