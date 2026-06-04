# Code Review — Performance & Security Improvements

> Last updated: 2026-06-04
> Reviewed by: Abhik Nayak

---

## Progress Tracker

| # | Issue | Impact | Difficulty | Status |
|---|---|---|---|---|
| 1 | Vite dev server in production | Huge | Medium | Done |
| 2 | No compression middleware | High | Easy | Pending |
| 3 | No helmet security headers | High | Easy | Pending |
| 4 | CORS allows all origins | Medium | Easy | Pending |
| 5 | Full refetch after every mutation | Medium | Easy | Pending |
| 6 | No loading/error states in UI | Medium | Easy | Pending |
| 7 | No database index on `created_at` | Medium | Easy | Pending |
| 8 | No rate limiting | Medium | Easy | Pending |
| 9 | `err.message` exposed to client | Low | Easy | Pending |

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

## 2. No Compression Middleware — PENDING

**Problem:**
Express sends raw uncompressed JSON and HTML. Every API response and static file is sent at full size over the network, making the app 60-70% slower on slow connections.

**What to do:**
- Install `compression` package
- Add `app.use(compression())` in `server/index.js`

**Files to change:** `server/index.js`, `server/package.json`

---

## 3. No Helmet Security Headers — PENDING

**Problem:**
Express doesn't set security HTTP headers. Missing headers like `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` leave the app vulnerable to common attacks (clickjacking, MIME sniffing, etc).

**What to do:**
- Install `helmet` package
- Add `app.use(helmet())` in `server/index.js`

**Files to change:** `server/index.js`, `server/package.json`

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

## 5. Full Refetch After Every Mutation — PENDING

**Problem:**
Every `addTodo`, `updateTodo`, `deleteTodo` calls `fetchTodos()` which reloads ALL todos from the database. With 100 todos, checking one checkbox fetches all 100 rows again.

**What to do:**
Update state locally instead of refetching:
```javascript
// Instead of: if (res.ok) fetchTodos();
// Do this:
const addTodo = async (title) => {
  const res = await fetch(API_URL, { ... });
  if (res.ok) {
    const newTodo = await res.json();
    setTodos((prev) => [newTodo, ...prev]);
  }
};

const deleteTodo = async (id) => {
  const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  if (res.ok) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }
};

const updateTodo = async (id, updates) => {
  const res = await fetch(`${API_URL}/${id}`, { ... });
  if (res.ok) {
    const updated = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingTodo(null);
  }
};
```

**Files to change:** `client/src/App.jsx`

---

## 6. No Loading/Error States in UI — PENDING

**Problem:**
If the API is slow or fails, the user sees a blank screen with no feedback. No spinner, no error message.

**What to do:**
Add `loading` and `error` state:
```jsx
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

const fetchTodos = async () => {
  try {
    setLoading(true);
    const res = await fetch(API_URL);
    const data = await res.json();
    setTodos(data);
    setError(null);
  } catch (err) {
    setError("Failed to load todos");
  } finally {
    setLoading(false);
  }
};

// In JSX:
{loading && <p>Loading...</p>}
{error && <p className="error">{error}</p>}
```

**Files to change:** `client/src/App.jsx`, `client/src/App.css`

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

## 8. No Rate Limiting — PENDING

**Problem:**
Anyone can spam your API with unlimited requests. A simple script could send 10,000 requests per second and crash your server or fill your database.

**What to do:**
- Install `express-rate-limit` package
- Add rate limiter middleware:
```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // 100 requests per IP per window
  message: { error: "Too many requests, try again later" }
});

app.use("/api/", limiter);
```

**Files to change:** `server/index.js`, `server/package.json`

---

## 9. `err.message` Exposed to Client — PENDING

**Problem:**
When a 500 error occurs, the raw error message is sent to the client:
```javascript
res.status(500).json({ error: err.message });
```
This can leak internal details like database table names, column names, or connection strings.

**What to do:**
Log the real error server-side, send a generic message to the client:
```javascript
catch (err) {
  console.error(err.message);
  res.status(500).json({ error: "Server error" });
}
```

**Files to change:** `server/routes/todos.js`

---

## How to Use This Document

1. Pick a pending item
2. Create a feature branch: `git checkout -b fix/item-number-description`
3. Apply the changes
4. Test locally
5. Update the status in this file from `Pending` to `Done`
6. Add a summary of what was changed (like item #1)
7. Push and create a PR to `dev`
