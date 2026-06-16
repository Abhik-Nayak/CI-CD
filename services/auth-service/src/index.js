// Service entrypoint: wires up Express, the DB, and the HTTP server.
import express from "express";
import { config } from "./config.js";
import { initSchema, waitForDb, pool } from "./db.js";
import { authRouter } from "./routes/auth.js";

const app = express();
app.use(express.json());

// Health endpoint. EVERY service gets one. Docker, Compose healthchecks,
// Kubernetes liveness/readiness probes, and load balancers all poll this to
// decide if the container is alive and ready for traffic. Keep it cheap.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "auth-service", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", service: "auth-service", db: "down" });
  }
});

app.use("/api/auth", authRouter);

async function start() {
  await waitForDb();
  await initSchema();
  app.listen(config.port, () => {
    console.log(`[auth-service] listening on :${config.port}`);
  });
}

start().catch((err) => {
  console.error("[auth-service] failed to start:", err);
  process.exit(1); // non-zero exit so Docker/K8s know the container is unhealthy
});
