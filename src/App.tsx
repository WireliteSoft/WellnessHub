// src/App.tsx
import React, { useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import { RecipesProvider } from "./contexts/RecipesContext";

import { useAuth } from "./contexts/AuthContext"; // ⬅ added

import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import NutritionSection from "./components/NutritionSection";
import ExerciseSection from "./components/ExerciseSection";
import DiabetesSection from "./components/DiabetesSection";
import GoalsSection from "./components/GoalsSection";
// import AdminRecipes from "./components/admin/AdminRecipes"; // ⬅ replaced by AdminPanel
import AdminPanel from "./components/admin/AdminPanel"; // ⬅ new tabbed admin area (Recipes + Users)

type Tab = "dashboard" | "nutrition" | "exercise" | "diabetes" | "goals" | "admin";

const AppInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || user?.is_admin === 1 || user?.is_admin === true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => {
          setActiveTab(t as Tab);
          setMobileMenuOpen(false);
        }}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "nutrition" && <NutritionSection />}
        {activeTab === "exercise" && <ExerciseSection />}
        {activeTab === "diabetes" && <DiabetesSection />}
        {activeTab === "goals" && <GoalsSection />}

        {activeTab === "admin" &&
          (isAdmin ? (
            <AdminPanel />
          ) : (
            <div className="text-center py-16 text-gray-600 dark:text-gray-300">
              <div className="text-2xl font-semibold mb-2">403 — Admins only</div>
              <div className="text-sm">Your account doesn’t have admin privileges.</div>
            </div>
          ))}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <RecipesProvider>
            <AppInner />
          </RecipesProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;