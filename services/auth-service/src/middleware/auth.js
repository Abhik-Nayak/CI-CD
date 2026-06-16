// Auth middleware: verifies the short-lived ACCESS token on protected routes.
//
// The access token is a JWT signed with JWT_ACCESS_SECRET. It is stateless —
// we don't hit the database to validate it, we just verify the signature and
// expiry. That statelessness is exactly what lets us scale to many instances
// (any instance can verify any token). The trade-off: we can't instantly
// revoke an access token, which is why we keep it short-lived (15m) and use
// refresh tokens (which ARE stored, and thus revocable) for longevity.
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

// Role gate — Phase-1 groundwork for Role Based Access Control.
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
