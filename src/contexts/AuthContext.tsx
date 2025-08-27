import React, { createContext, useContext, useMemo } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { User } from "../types";

type AuthUser = Pick<User, "id" | "name" | "email">;

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useLocalStorage<AuthUser | null>("auth:user", null);
  const [, setToken] = useLocalStorage<string | null>("auth:token", null);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: !!user,
    login: async (email, _password) => {
      // fake auth — replace with API later
      const name = email.split("@")[0];
      setUser({ id: String(Date.now()), name, email });
      setToken("dev-token");
    },
    signup: async (name, email, _password) => {
      setUser({ id: String(Date.now()), name, email });
      setToken("dev-token");
    },
    logout: () => {
      setUser(null);
      setToken(null);
    }
  }), [user, setUser, setToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
