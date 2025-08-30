import React, { PropsWithChildren } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Landing } from "../Landing";

export const AuthGate: React.FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  let allowed = isAuthenticated;
  if (!allowed && typeof window !== "undefined") {
    const token = localStorage.getItem("auth:token");
    const raw = localStorage.getItem("auth:user");
    const u = raw ? (()=>{ try { return JSON.parse(raw); } catch { return null; }})() : null;
    allowed = !!token && !!(u && u.id);
  }

  return allowed ? <>{children}</> : <Landing />;
};
