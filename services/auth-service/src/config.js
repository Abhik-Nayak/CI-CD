// Centralised configuration.
// We read EVERYTHING from environment variables — never hard-code secrets or
// hostnames. This is a core 12-factor / DevOps principle: the same image runs
// in local Docker, CI, and prod, configured only by env. Compose/K8s will
// inject these later.
import dotenv from "dotenv";

dotenv.config(); // loads a local .env file when running outside Docker

export const config = {
  port: parseInt(process.env.PORT ?? "4001", 10),

  // Postgres connection. In Docker the host is the *service name* (e.g.
  // "postgres-auth"), not "localhost" — that's Docker DNS, a Phase 2 lesson.
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    user: process.env.DB_USER ?? "auth",
    password: process.env.DB_PASSWORD ?? "auth",
    database: process.env.DB_NAME ?? "auth",
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
};
