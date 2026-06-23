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
});

module.exports = pool;
