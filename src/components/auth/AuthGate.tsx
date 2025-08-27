import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Landing } from "../Landing";

export const AuthGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    // block the app entirely until auth
    return <Landing />;
  }
  return <>{children}</>;
};
