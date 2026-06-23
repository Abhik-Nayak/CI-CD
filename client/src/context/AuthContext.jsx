import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });

  const setSession = useCallback((newToken, newUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  // Auto-logout when ANY api call returns 401 (expired/invalid token).
  // The api client dispatches this event; handling it here means no component
  // has to deal with 401 itself — clearing the token triggers ProtectedRoute
  // to redirect to /login.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  // Auth flows live in the context now — pages just call signIn/signUp.
  const signIn = useCallback(
    async (email, password) => {
      const data = await authApi.login(email, password);
      setSession(data.token, data.user);
    },
    [setSession]
  );

  const signUp = useCallback(
    async (email, password) => {
      const data = await authApi.signup(email, password);
      setSession(data.token, data.user);
    },
    [setSession]
  );

  return (
    <AuthContext.Provider value={{ token, user, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
