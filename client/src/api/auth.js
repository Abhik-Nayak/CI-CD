import { api } from "./client";

// auth-service endpoints (gateway routes /api/auth → auth-service).
// auth: false → don't attach a token; these calls create one.
export const authApi = {
  login: (email, password) =>
    api.post("/api/auth/login", { email, password }, { auth: false }),
  signup: (email, password) =>
    api.post("/api/auth/signup", { email, password }, { auth: false }),
};
