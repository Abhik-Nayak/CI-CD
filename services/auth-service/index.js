require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./db");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT;

// nginx gateway sits in front — trust its X-Forwarded-For (value 1, not true)
// so express-rate-limit identifies clients by real IP without being spoofable.
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

app.use("/api/auth", apiLimiter, authRoutes);

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
    service: "auth-service",
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
  // auth_db owns the users table only.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("auth_db tables ready");

  app.listen(PORT, () => {
    console.log(`auth-service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start auth-service:", err);
  process.exit(1);
});
