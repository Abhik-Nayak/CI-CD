const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5434"),
  database: process.env.DB_NAME || "TODO",
});

module.exports = pool;
