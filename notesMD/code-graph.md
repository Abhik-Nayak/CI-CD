# Code Graph

A visual map of how this codebase is wired together — module imports, the
request flow through the containers, and the trust relationship between
services. Render these in VS Code (Markdown Preview Mermaid Support) or on
GitHub, both of which draw Mermaid natively.

> Generated from the actual imports/routes in the repo. If you move or rename
> files, update the affected diagram.

---

## 1. Runtime request flow (containers)

Who talks to whom at runtime. The browser only ever reaches the client; the
gateway is the single entry point to the backend, which it routes by path
prefix. Both services share one Aurora database but each owns one table.

```mermaid
flowchart TD
    Browser["🌐 Browser (:80)"]

    subgraph net["todo-network (internal)"]
        Client["client<br/>nginx — serves React SPA<br/>forwards /api → gateway"]
        Gateway["gateway<br/>nginx — routes by path prefix"]
        Auth["auth-service :5002<br/>owns users table"]
        Todo["todo-service :5001<br/>owns todos table"]
    end

    DB[("Aurora PostgreSQL<br/>devdb (ap-south-1)")]

    Browser -->|HTTP| Client
    Client -->|/api/*| Gateway
    Gateway -->|/api/auth| Auth
    Gateway -->|/api/todos| Todo
    Auth -->|users table| DB
    Todo -->|todos table| DB

    Auth -. "signs JWT (JWT_SECRET)" .-> Todo
```

The dashed line is **not** a network call — todo-service never calls
auth-service. It only shares the same `JWT_SECRET`, so it can verify tokens
auth-service signed. That's what keeps logged-in users working even if
auth-service is down.

---

## 2. Frontend module graph (`client/src`)

How the React app is imported together. All network traffic funnels through
`api/client.js`, and the two React contexts (auth + theme) wrap the app.

```mermaid
flowchart TD
    mainjsx["main.jsx"]
    App["App.jsx"]
    ThemeProv["context/ThemeContext.jsx"]
    AuthProv["context/AuthContext.jsx"]
    ThemeToggle["components/ThemeToggle.jsx"]

    Protected["components/ProtectedRoute.jsx"]
    Login["pages/Login.jsx"]
    Signup["pages/Signup.jsx"]
    Todos["pages/Todos.jsx"]
    TodoForm["components/TodoForm.jsx"]
    TodoList["components/TodoList.jsx"]

    apiClient["api/client.js<br/>(fetch + JWT + errors)"]
    authApi["api/auth.js"]
    todosApi["api/todos.js"]

    theme["theme.css (design tokens)"]

    mainjsx --> ThemeProv
    mainjsx --> AuthProv
    mainjsx --> App
    mainjsx --> theme

    App --> ThemeToggle
    App --> Login
    App --> Signup
    App --> Protected
    Protected --> Todos

    ThemeToggle --> ThemeProv

    Login --> AuthProv
    Signup --> AuthProv
    Todos --> AuthProv
    Todos --> TodoForm
    Todos --> TodoList

    AuthProv --> authApi
    Todos --> todosApi

    authApi --> apiClient
    todosApi --> apiClient

    apiClient -. "401 → window 'auth:unauthorized'" .-> AuthProv
```

Key edges:
- **`api/client.js` is the single network chokepoint** — token injection, JSON
  parsing, and error handling live only here.
- A **401** from any request dispatches a `window` event that `AuthContext`
  listens for → clears the session → `ProtectedRoute` redirects to `/login`.
- **`theme.css`** is the design-token source of truth; every component styles
  itself from its `var(--*)` tokens, and `ThemeContext` flips `data-theme` on
  `<html>` to switch light/dark.

---

## 3. Backend service internals

Both services follow the same self-contained shape: `index.js` wires
middleware + routes, `routes/*` run queries through `db.js`, and `db.js` owns
the single shared `pg` pool. They share **no code**.

```mermaid
flowchart LR
    subgraph auth["auth-service"]
        aIndex["index.js<br/>express + helmet + cors<br/>rate-limit + /api/health"]
        aRoutes["routes/auth.js<br/>login / signup<br/>signs JWT"]
        aDb["db.js (pg pool, TLS)"]
        aIndex --> aRoutes
        aIndex --> aDb
        aRoutes --> aDb
    end

    subgraph todo["todo-service"]
        tIndex["index.js<br/>express + helmet + cors<br/>rate-limit + /api/health"]
        tMw["middleware/auth.js<br/>verifies JWT<br/>sets req.user"]
        tRoutes["routes/todos.js<br/>CRUD, scoped by user_id"]
        tDb["db.js (pg pool, TLS)"]
        tIndex --> tMw
        tIndex --> tRoutes
        tIndex --> tDb
        tMw --> tRoutes
        tRoutes --> tDb
    end

    DB[("Aurora: devdb")]
    aDb --> DB
    tDb --> DB
```

- Every `/api/todos/*` request passes through **`middleware/auth.js` first**,
  which verifies the JWT and puts `req.user` on the request. Routes then scope
  every query by `user_id = req.user.id` — that's the only thing isolating one
  user's todos from another's.
- Tables are created on boot via `CREATE TABLE IF NOT EXISTS` in each
  `start()` — there are no migration files.
- `todos.user_id` is a plain `INTEGER` with **no** `REFERENCES users(id)` — the
  services deliberately don't couple across table ownership.

---

## 4. The auth trust link (why there's no service-to-service call)

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as gateway
    participant A as auth-service
    participant T as todo-service
    participant D as Aurora devdb

    B->>G: POST /api/auth/login
    G->>A: /api/auth/login
    A->>D: SELECT user, verify password
    A-->>B: JWT (signed with JWT_SECRET)

    Note over B: stores token in localStorage

    B->>G: GET /api/todos (Bearer JWT)
    G->>T: /api/todos
    T->>T: verify JWT locally (same JWT_SECRET)
    T->>D: SELECT todos WHERE user_id = <from token>
    T-->>B: todos
```

todo-service **never** contacts auth-service — it trusts the token's signature.
Shared secret, not a network dependency. This is the central architectural
decision of the project.
