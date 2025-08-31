import React, { useState } from "react";
import { AuthCard } from "./auth/AuthCard";
import { LoginForm } from "./auth/LoginForm";
import { SignupForm } from "./auth/SignupForm";
import { useTheme } from "../contexts/ThemeContext";

export const Landing: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const { isDarkMode } = useTheme();

  return (
<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
  {/* top stripe matches app vibe */}
  <div className="h-1 w-full bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-gray-100 dark:via-gray-300 dark:to-gray-100" />

  {/* NOTE: items-start so the right-column title sits tight above the card */}
  <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
    {/* Left: Logo + blurb */}
    <div>
      {/* Logo only */}
      <div className="flex items-center justify-center lg:justify-start">
        <img
          src="/logo.png"
          alt="WellnessHub logo"
          className="h-50 w-50 rounded-xl object-contain shadow-sm ring-1 ring-black/10 dark:ring-white/10"
          decoding="async"
        />
      </div>

      {/* MOBILE/TABLET TITLE (hidden on lg+) */}
      <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100 lg:hidden text-center sm:text-left">
        Wellness Tracker
      </h1>

      <p className="mt-6 text-gray-700 dark:text-gray-300 leading-relaxed">
        Track workouts, nutrition, goals, and blood glucose in one place.
        Privacy-friendly, fast, and designed for real life. Log in to start tracking.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <li>• Exercise planner with built-in timer</li>
        <li>• Goals with progress tracking</li>
        <li>• Diabetes readings and trends</li>
        <li>• Dark mode, responsive UI</li>
      </ul>
    </div>

    {/* Right: Auth card */}
    <div>
      {/* DESKTOP TITLE (hidden below lg) */}
      <h1 className="hidden lg:block text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Wellness Tracker
      </h1>

      <AuthCard
        title={mode === "signup" ? "Create your account" : "Welcome back"}
        subtitle={mode === "signup" ? "Sign up to start tracking" : "Sign in to continue"}
      >
        <div className="mb-4 flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
          <button
            className={`w-1/2 py-2 text-sm font-medium ${
              mode === "signup"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-transparent text-gray-700 dark:text-gray-300"
            }`}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
          <button
            className={`w-1/2 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-transparent text-gray-700 dark:text-gray-300"
            }`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
        </div>

        {mode === "signup" ? <SignupForm /> : <LoginForm />}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          By continuing you agree to the Terms. This is a demo auth flow; real authentication will be added later.
        </p>
      </AuthCard>
    </div>
  </div>

  <footer className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
    {isDarkMode ? "Dark mode" : "Light mode"} • © {new Date().getFullYear()}
  </footer>
</div>

  );
};
