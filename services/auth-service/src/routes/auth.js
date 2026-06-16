// Auth routes: register, login, refresh, logout, and a protected /me.
//
// Token model (industry standard):
//   - ACCESS token  : short-lived (15m), stateless JWT, sent on every request.
//   - REFRESH token : long-lived (7d), stored in DB so it can be revoked.
// When the access token expires, the client calls /refresh with the refresh
// token to get a fresh access token — without re-entering a password.
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

// --- helpers ---------------------------------------------------------------

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  });
}

// Persist the refresh token so we can revoke it on logout / detect reuse.
// (In Phase 7 we move this store from Postgres to Redis — a deliberate lesson
// in why session state gets externalised for horizontal scaling.)
async function storeRefreshToken(userId, token) {
  const { exp } = jwt.decode(token); // seconds since epoch
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, to_timestamp($3))",
    [userId, token, exp]
  );
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- routes ----------------------------------------------------------------

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!emailRegex.test(email ?? "")) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // Hash with bcrypt. We NEVER store the plaintext password. The "10" is the
  // cost factor — higher = slower = harder to brute-force.
  const hash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role",
      [email, hash]
    );
    const user = rows[0];

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken);

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation — email already registered
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("[register]", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  const { rows } = await pool.query(
    "SELECT id, email, password, role FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];

  // Generic message + always run a compare-ish path: don't leak whether the
  // email exists, and avoid trivial timing differences.
  const ok = user ? await bcrypt.compare(password ?? "", user.password) : false;
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);

  return res.json({
    user: { id: user.id, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh  — exchange a valid refresh token for a new access token
authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  // 1) Signature + expiry must be valid.
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // 2) It must still exist in our store (i.e. not logged out / revoked).
  const { rows } = await pool.query(
    "SELECT rt.token, u.id, u.email, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = $1",
    [refreshToken]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: "Refresh token revoked" });
  }

  const user = rows[0];

  // 3) Rotate: invalidate the old refresh token, issue a brand new pair.
  //    Rotation limits the damage if a refresh token ever leaks.
  const newRefresh = signRefreshToken(user);
  await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
  await storeRefreshToken(user.id, newRefresh);

  return res.json({
    accessToken: signAccessToken(user),
    refreshToken: newRefresh,
  });
});

// POST /api/auth/logout — revoke the given refresh token
authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
  }
  return res.status(204).end();
});

// GET /api/auth/me — protected; proves the access token works end-to-end
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
