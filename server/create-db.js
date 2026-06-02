const { Client } = require("pg");

async function createDb() {
  const client = new Client({
    user: "postgres",
    password: "postgres",
    host: "localhost",
    port: 5434,
    database: "postgres",
  });

  await client.connect();
  const res = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'TODO'"
  );

  if (res.rows.length === 0) {
    await client.query('CREATE DATABASE "TODO"');
    console.log("Database TODO created");
  } else {
    console.log("Database TODO already exists");
  }

  await client.end();
}

createDb().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
