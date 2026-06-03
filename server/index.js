require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const todoRoutes = require("./routes/todos");


const app = express();
const PORT = process.env.PORT;


app.use(cors());
app.use(express.json());

app.use("/api/todos", todoRoutes);

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
