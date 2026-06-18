# Contributing Guide — PERN Todo App

Welcome to the project! Read this before writing any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Getting Started](#2-getting-started)
3. [Folder Structure](#3-folder-structure)
4. [Git Workflow](#4-git-workflow)
5. [Coding Standards — Backend](#5-coding-standards--backend)
6. [Coding Standards — Frontend](#6-coding-standards--frontend)
7. [API Conventions](#7-api-conventions)
8. [Environment Variables](#8-environment-variables)
9. [CSS & Styling](#9-css--styling)
10. [Deployment](#10-deployment)
11. [Do's and Don'ts](#11-dos-and-donts)

---

## 1. Project Overview

| Stack | Technology |
|---|---|
| **P** — Database | PostgreSQL |
| **E** — Backend | Express.js (Node.js) |
| **R** — Frontend | React 19 (Vite) |
| **N** — Runtime | Node.js |
| **Deployment** | AWS EC2 + PM2 + GitHub Actions |

---

## 2. Getting Started

### Prerequisites

- Node.js v18+ installed
- PostgreSQL running locally (port 5432 or 5434)
- Git configured

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd CI-CD

# 2. Switch to dev branch
git checkout dev

# 3. Install all dependencies (root + server + client)
npm run install-all

# 4. Set up environment variables (see Section 8)
# Create server/.env
# Create client/.env

# 5. Create the database table
cd server && node create-db.js && cd ..

# 6. Start the app
npm run dev
```

This runs both backend (port 5000) and frontend (port 5173) concurrently.

### Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend together |
| `npm run start:backend` | Start only the Express server |
| `npm run start:frontend` | Start only the Vite dev server |
| `npm run install-all` | Install dependencies for root, server, and client |
| `npm run pm2:start` | Start both apps via PM2 (server/EC2 only) |
| `npm run pm2:logs` | View PM2 logs |

---

## 3. Folder Structure

```
CI-CD/
├── .github/
│   └── workflows/
│       └── deploy-dev.yml        # Auto-deploy on push to dev
│
├── server/                       # Backend (Express + PostgreSQL)
│   ├── index.js                  # Entry point — server setup, middleware, startup
│   ├── db.js                     # Database connection pool
│   ├── create-db.js              # One-time DB table creation script
│   ├── routes/
│   │   └── todos.js              # All /api/todos endpoints
│   ├── .env                      # Server environment variables (DO NOT COMMIT)
│   └── package.json
│
├── client/                       # Frontend (React + Vite)
│   ├── src/
│   │   ├── main.jsx              # React entry point (mounts to #root)
│   │   ├── App.jsx               # Root component (state, API calls)
│   │   ├── App.css               # All component styles
│   │   ├── index.css             # Global styles (reset, body)
│   │   └── components/
│   │       ├── TodoForm.jsx      # Add/edit todo form
│   │       └── TodoList.jsx      # Todo list display
│   ├── .env                      # Dev API URL
│   ├── .env.production           # Production API URL
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
│
├── ecosystem.config.js           # PM2 config for EC2 deployment
├── package.json                  # Root scripts (dev, install-all, pm2)
├── CONTRIBUTING.md               # This file
└── DEVOPS-NOTES.md               # CI/CD and PM2 documentation
```

### Rules

- Backend code goes in `server/` only
- Frontend code goes in `client/src/` only
- Components go in `client/src/components/`
- Route files go in `server/routes/`
- Never put code in the root directory (root is only for config files)

---

## 4. Git Workflow

### Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `dev` | Active development | Dev EC2 (auto-deploy) |
| `qa` | QA testing | QA environment |
| `prod` | Production (stable) | Production EC2 |
| `master` | Legacy/staging | — |

### Branch Rules

1. **Never push directly to `prod`** — always go through a Pull Request
2. **All new work starts from `dev`**
3. **Flow:** `feature-branch` → `dev` → `qa` → `prod`

### Creating a Feature Branch

```bash
# Start from dev
git checkout dev
git pull origin dev

# Create your branch
git checkout -b feature/add-user-auth

# ... do your work ...

# Push and create a PR to dev
git push origin feature/add-user-auth
```

### Branch Naming Convention

```
feature/short-description     # New feature
fix/short-description         # Bug fix
hotfix/short-description      # Urgent production fix
refactor/short-description    # Code cleanup
```

Examples:
- `feature/add-user-auth`
- `fix/todo-delete-not-working`
- `hotfix/db-connection-crash`

### Commit Messages

Use this format:

```
<type>: <short description>

<optional body — explain WHY, not WHAT>
```

**Types:**

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no new feature, no bug fix) |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons (no logic change) |
| `chore` | Config changes, dependency updates |

**Examples:**

```
feat: add health check endpoint
fix: todo delete returning 500 on invalid ID
refactor: extract DB validation to separate function
chore: update express to v4.21
docs: add contributing guide
```

**Bad commits (don't do this):**

```
fixed stuff
update
wip
asdfgh
changes
```

---

## 5. Coding Standards — Backend

### Module System

Use **CommonJS** (`require` / `module.exports`):

```javascript
// CORRECT
const express = require("express");
module.exports = router;

// WRONG — don't use ES modules in server
import express from "express";
export default router;
```

### Formatting Rules

| Rule | Standard | Example |
|---|---|---|
| Semicolons | Always use them | `const x = 5;` |
| Quotes | Double quotes `"` | `const name = "todo";` |
| Variables | Use `const` by default, `let` if reassigned | `const app = express();` |
| No `var` | Never use `var` | — |
| Indentation | 2 spaces | — |
| Trailing commas | Yes, in multiline objects/arrays | `{ a: 1, b: 2, }` |

### Async/Await

Always use `async/await` with `try/catch`. No callbacks, no `.then()` chains:

```javascript
// CORRECT
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM todos");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// WRONG — callback style
pool.query("SELECT * FROM todos", (err, result) => {
  if (err) throw err;
  res.json(result.rows);
});

// WRONG — .then() chain
pool.query("SELECT * FROM todos")
  .then(result => res.json(result.rows))
  .catch(err => res.status(500).json({ error: err.message }));
```

### Database Queries

Always use **parameterized queries** to prevent SQL injection:

```javascript
// CORRECT — parameterized (safe)
const result = await pool.query(
  "SELECT * FROM todos WHERE id = $1",
  [req.params.id]
);

// WRONG — string concatenation (SQL injection risk!)
const result = await pool.query(
  "SELECT * FROM todos WHERE id = " + req.params.id
);

// WRONG — template literals (SQL injection risk!)
const result = await pool.query(
  `SELECT * FROM todos WHERE id = ${req.params.id}`
);
```

### Error Handling

Every route must have `try/catch`. Return proper status codes:

```javascript
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM todos WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});
```

**Status codes used in this project:**

| Code | When |
|---|---|
| `200` | Success (GET, PUT, DELETE) |
| `201` | Created (POST) |
| `400` | Bad request (missing/invalid input) |
| `404` | Resource not found |
| `500` | Server/database error |

### Route File Pattern

Follow the existing pattern in `server/routes/todos.js`:

```javascript
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all
router.get("/", async (req, res) => { ... });

// GET one
router.get("/:id", async (req, res) => { ... });

// POST create
router.post("/", async (req, res) => { ... });

// PUT update
router.put("/:id", async (req, res) => { ... });

// DELETE
router.delete("/:id", async (req, res) => { ... });

module.exports = router;
```

When adding a new resource (e.g., users), create `server/routes/users.js` following this same pattern and mount it in `index.js`:

```javascript
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);
```

---

## 6. Coding Standards — Frontend

### Module System

Use **ES Modules** (`import` / `export`):

```javascript
// CORRECT
import { useState, useEffect } from "react";
export default App;

// WRONG — don't use require in client
const React = require("react");
```

### Component Pattern

Use **functional components** with **arrow functions**:

```jsx
// CORRECT
const TodoList = ({ todos, onDelete, onToggle }) => {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
};

export default TodoList;

// WRONG — class components
class TodoList extends React.Component { ... }

// WRONG — function keyword
function TodoList({ todos }) { ... }
```

### File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase `.jsx` | `TodoForm.jsx`, `TodoList.jsx` |
| Styles | PascalCase `.css` matching component | `App.css` |
| Utilities (if added) | camelCase `.js` | `formatDate.js` |

### Component Structure

Follow this order inside each component file:

```jsx
// 1. Imports
import { useState, useEffect } from "react";

// 2. Component
const TodoForm = ({ onSubmit, editingTodo, onUpdate, onCancelEdit }) => {
  // 3. State declarations
  const [title, setTitle] = useState("");

  // 4. Effects
  useEffect(() => {
    if (editingTodo) {
      setTitle(editingTodo.title);
    }
  }, [editingTodo]);

  // 5. Event handlers
  const handleSubmit = (e) => {
    e.preventDefault();
    // ...
  };

  // 6. Return JSX
  return (
    <form onSubmit={handleSubmit}>
      ...
    </form>
  );
};

// 7. Export
export default TodoForm;
```

### State Management

This project uses **React hooks** (no Redux, no Context API):

```jsx
// State lives in App.jsx and is passed down as props
const [todos, setTodos] = useState([]);
const [editingTodo, setEditingTodo] = useState(null);
```

- `App.jsx` owns all state and API calls
- Child components receive data and callbacks via props
- If state management gets complex in the future, discuss before adding Redux/Context

### API Calls

Use the **native `fetch` API** (no axios):

```jsx
// CORRECT — using fetch
const fetchTodos = async () => {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    setTodos(data);
  } catch (err) {
    console.error(err.message);
  }
};

// WRONG — don't add axios (keep dependencies minimal)
const response = await axios.get(API_URL);
```

The API base URL comes from environment variables:

```jsx
const API_URL = import.meta.env.VITE_API_URL;
```

### Props

Always use **destructuring** in component parameters:

```jsx
// CORRECT
const TodoList = ({ todos, onDelete, onToggle, onEdit }) => { ... };

// WRONG
const TodoList = (props) => {
  props.todos.map(...)
};
```

---

## 7. API Conventions

### URL Pattern

All API endpoints follow: `/api/<resource>`

```
/api/todos          # Todo endpoints
/api/users          # Future: User endpoints
/api/categories     # Future: Category endpoints
```

### HTTP Methods

| Method | URL | Action | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/todos` | Get all | — | `[{id, title, completed, created_at}]` |
| `GET` | `/api/todos/:id` | Get one | — | `{id, title, completed, created_at}` |
| `POST` | `/api/todos` | Create | `{title}` | `{id, title, completed, created_at}` |
| `PUT` | `/api/todos/:id` | Update | `{title?, completed?}` | `{id, title, completed, created_at}` |
| `DELETE` | `/api/todos/:id` | Delete | — | `{message, deleted: {...}}` |

### Response Format

**Success:**
```json
{
  "id": 1,
  "title": "Buy groceries",
  "completed": false,
  "created_at": "2026-06-04T00:00:00.000Z"
}
```

**Error:**
```json
{
  "error": "Todo not found"
}
```

### Input Validation Rules

- `title` is **required** for POST
- `title` is **trimmed** (whitespace removed)
- Empty string after trim returns 400
- PUT accepts partial updates (only send fields you want to change)

---

## 8. Environment Variables

### Server (`server/.env`)

```env
DB_USER=postgres
DB_PASS=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=todos
PORT=5000
```

### Client (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api/todos
```

### Client Production (`client/.env.production`)

```env
VITE_API_URL=http://<EC2-IP>:5000/api/todos
```

### Rules

- **NEVER commit `.env` files** (they are in `.gitignore`)
- **NEVER hardcode** IPs, passwords, or secrets in code
- Frontend env vars **must** start with `VITE_` (Vite requirement)
- Access in backend: `process.env.PORT`
- Access in frontend: `import.meta.env.VITE_API_URL`
- When adding a new env var, tell the team and update this document

---

## 9. CSS & Styling

### Approach

This project uses **plain CSS** with a single file per scope:

| File | Purpose |
|---|---|
| `client/src/index.css` | Global reset, body font, background |
| `client/src/App.css` | All component styles |

### Rules

- All styles go in `App.css` (no inline styles, no CSS-in-JS)
- Use **class names**, not IDs for styling
- Use **descriptive class names**: `.todo-item`, `.todo-form`, not `.t1`, `.box`
- Use **kebab-case** for class names: `todo-list`, not `todoList` or `TodoList`
- Follow existing color scheme:

| Color | Hex | Usage |
|---|---|---|
| Primary Blue | `#4361ee` | Buttons, links |
| Hover Blue | `#3a56d4` | Button hover state |
| Yellow | `#ffc107` | Edit button |
| Red | `#dc3545` | Delete button |
| Light Gray | `#f5f5f5` | Background |
| Dark Text | `#333` | Primary text |

### Layout

- Container is `max-width: 600px`, centered
- Use **flexbox** for layouts (no float, no grid unless needed)

---

## 10. Deployment

### How It Works

Pushing to `dev` branch triggers automatic deployment:

```
git push origin dev
    → GitHub Actions triggers
    → SSHs into EC2
    → git pull, npm install, pm2 restart
    → App is live
```

### What NOT to Do

- Never SSH into EC2 and edit code directly
- Never run `git push --force` on `dev` or `prod`
- Never commit `node_modules/`, `.env`, or log files
- Never change `ecosystem.config.js` without telling the team (it affects the live server)

### PM2 Commands (on EC2 only)

```bash
pm2 list                          # Check app status
pm2 logs                          # View live logs
pm2 restart ecosystem.config.js   # Restart after manual changes
```

---

## 11. Do's and Don'ts

### Do

- Pull latest `dev` before starting work: `git pull origin dev`
- Create a feature branch for every task
- Write descriptive commit messages
- Use `const` by default, `let` only when needed
- Use `async/await` for all async operations
- Use parameterized queries for all database operations
- Destructure props in React components
- Test your changes locally before pushing
- Keep dependencies minimal — discuss before adding new packages

### Don't

- Don't push directly to `prod` or `dev` — use Pull Requests
- Don't use `var` — ever
- Don't use callbacks or `.then()` chains
- Don't use string concatenation in SQL queries
- Don't install new npm packages without team discussion
- Don't use inline styles in React components
- Don't use `axios` — use native `fetch`
- Don't use class components — use functional with hooks
- Don't commit `.env` files or any secrets
- Don't use `console.log` in production code (use it only for debugging, remove before PR)
- Don't modify `ecosystem.config.js` or workflow files without team approval

---

## Quick Reference Card

```
Server: CommonJS, double quotes, semicolons, async/await, parameterized SQL
Client: ES Modules, double quotes, semicolons, functional components, fetch API
Git:    feature/* → dev → qa → prod (PRs required)
Style:  Plain CSS in App.css, flexbox, kebab-case classes
Env:    Never commit .env, frontend vars need VITE_ prefix
Deploy: Push to dev = auto-deploy via GitHub Actions + PM2
```
