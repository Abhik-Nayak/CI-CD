const jwt = require("jsonwebtoken");

// todo-service does NOT call auth-service to validate a user.
// It trusts the JWT signed by auth-service (same JWT_SECRET) and reads
// the user id straight from the verified token. This is what keeps the
// two services decoupled — no cross-service DB lookup, no network call.
module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = auth.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
