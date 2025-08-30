import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

type AuthUser = { id: string; name: string | null; email: string; is_admin?: number|boolean; is_nutritionist?: number|boolean };
type Ctx = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth:user");
      const u = raw ? JSON.parse(raw) : null;
      if (u?.id) setUser(u);
    } catch {}
  }, []);

  async function login(email: string, password: string) {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) throw new Error(await r.text());
    const { token, user } = await r.json();
    localStorage.setItem("auth:token", token);
    localStorage.setItem("auth:user", JSON.stringify(user));
    setUser(user);
  }

  async function signup(name: string, email: string, password: string) {
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (!r.ok) throw new Error(await r.text());
    const { token, user } = await r.json();
    localStorage.setItem("auth:token", token);
    localStorage.setItem("auth:user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    const t = localStorage.getItem("auth:token");
    if (t) fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + t } }).catch(() => {});
    localStorage.removeItem("auth:token");
    localStorage.removeItem("auth:user");
    setUser(null);
  }

  const value = useMemo<Ctx>(() => ({
    user,
    isAuthenticated: !!user?.id,
    login, signup, logout
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
