require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const pool = require("./db");
const todoRoutes = require("./routes/todos");


const app = express();
const PORT = process.env.PORT;


app.use(cors());
app.use(express.json());

app.use("/api/todos", todoRoutes);

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

// Serve React built files (must be AFTER all /api routes)
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("Database table ready");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
