// Database layer: a single shared connection pool + a tiny schema bootstrap.
//
// We use node-postgres ("pg"). A *pool* keeps a set of reusable connections so
// every request doesn't pay the cost of opening a new TCP connection to
// Postgres. This matters once the service scales.
//
// NOTE: We create tables here with CREATE TABLE IF NOT EXISTS for now so you
// can run the service with zero extra tooling. Real projects use migration
// tools (node-pg-migrate, Prisma, Flyway). We'll graduate to migrations later —
// for now, simplicity wins so you can focus on the DevOps moving parts.
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool(config.db);

// Run once on startup. Idempotent: safe to run every boot.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,            -- bcrypt hash, never plaintext
      role        TEXT NOT NULL DEFAULT 'user',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT UNIQUE NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Wait for Postgres to accept connections. In Docker the DB container may not
// be ready the instant our service starts, even with depends_on. Retrying is
// the robust pattern (we'll also add a Compose healthcheck in Phase 2).
export async function waitForDb({ retries = 10, delayMs = 1500 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(
        `[db] not ready (attempt ${attempt}/${retries}): ${err.code ?? err.message}`
      );
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
