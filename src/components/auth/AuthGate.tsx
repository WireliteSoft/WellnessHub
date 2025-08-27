// src/components/auth/AuthGate.tsx
import React, { PropsWithChildren, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Landing } from "../Landing";

export const AuthGate: React.FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const tokenPresent =
    typeof window !== "undefined" &&
    (localStorage.getItem("auth:token") || localStorage.getItem("auth:user"));

  const allowed = isAuthenticated || !!tokenPresent;

  // Debug in production build too:
  if (typeof window !== "undefined") {
    console.log("[AuthGate] isAuthenticated:", isAuthenticated, "tokenPresent:", !!tokenPresent, "allowed:", allowed);
  }

  return allowed ? <>{children}</> : <Landing />;
};
