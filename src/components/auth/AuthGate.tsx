// src/components/auth/AuthGate.tsx
import React, { PropsWithChildren } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Landing } from "../Landing";

export const AuthGate: React.FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  let allowed = isAuthenticated;

  if (!allowed && typeof window !== "undefined") {
    const rawToken = localStorage.getItem("auth:token");
    const rawUser = localStorage.getItem("auth:user");

    const hasToken = !!rawToken && rawToken !== "null" && rawToken !== '""';

    let hasUser = false;
    try {
      const u = rawUser ? JSON.parse(rawUser) : null;
      hasUser = !!(u && u.id);
    } catch {
      hasUser = false;
    }

    allowed = hasToken && hasUser; // must have BOTH
  }

  return allowed ? <>{children}</> : <Landing />;
};
