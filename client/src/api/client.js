// ─────────────────────────────────────────────────────────────────────────────
// Centralized API client.
// Every network call in the app goes through here, so token injection,
// JSON handling, and error handling live in ONE place instead of being
// copy-pasted into each component.
//
// Paths are relative ("/api/..."). The gateway in front (nginx in Docker,
// the Vite proxy in local dev) routes each prefix to the right microservice —
// the browser code never needs to know which port a service is on.
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  // Attach the JWT automatically when the call needs auth.
  if (auth) {
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401 = token missing/expired/invalid. Tell the app to log out, in one place.
  // AuthContext listens for this event and clears the session → redirect to login.
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  // DELETE and some responses may have an empty body — parse defensively.
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};
