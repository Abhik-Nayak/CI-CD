require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./db");
const todoRoutes = require("./routes/todos");
const authMiddleware = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT;

// nginx gateway sits in front — trust its X-Forwarded-For (value 1, not true).
app.set("trust proxy", 1);

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

app.use("/api/todos", authMiddleware, todoRoutes);

app.get("/api/health", async (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  let dbStatus = "healthy";
  let dbLatencyMs = null;
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = "unhealthy";
  }

  res.json({
    service: "todo-service",
    status: dbStatus === "healthy" ? "healthy" : "degraded",
    uptime: `${Math.floor(uptime)}s`,
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
    },
    nodeVersion: process.version,
  });
});

async function start() {
  // todo_db owns the todos table only.
  // user_id is a PLAIN column — NO "REFERENCES users(id)" — because the users
  // table lives in auth_db, a different database. We cannot foreign-key across
  // databases. The value is trusted from the verified JWT (see middleware/auth.js).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      user_id INTEGER NOT NULL
    )
  `);

  console.log("todo_db tables ready");

  app.listen(PORT, () => {
    console.log(`todo-service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start todo-service:", err);
  process.exit(1);
});
