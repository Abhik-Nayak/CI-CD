const { Pool } = require("pg");

const requiredEnvVars = ["DB_USER", "DB_PASS", "DB_HOST", "DB_PORT", "DB_NAME"];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  // Aurora/RDS reject non-TLS connections. rejectUnauthorized:false encrypts
  // the connection without verifying the server cert (matches AWS's own
  // quickstart). Set DB_SSL=false for a plain local Postgres with no TLS.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
