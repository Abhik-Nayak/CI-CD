require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./db");
const todoRoutes = require("./routes/todos");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT;

// One proxy (nginx) sits in front — trust its X-Forwarded-For so
// express-rate-limit can identify clients by real IP. Use 1, not true,
// so the header can't be spoofed to bypass rate limiting.
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

app.use("/api/auth", authRoutes);
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  `);

  console.log("Database tables ready");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
