// src/App.tsx
import React, { useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import NutritionSection from "./components/NutritionSection";
import ExerciseSection from "./components/ExerciseSection";
import DiabetesSection from "./components/DiabetesSection";
import GoalsSection from "./components/GoalsSection";

type Tab = "dashboard" | "nutrition" | "exercise" | "diabetes" | "goals";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <Header
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              mobileMenuOpen={mobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {activeTab === "dashboard" && <Dashboard />}
              {activeTab === "nutrition" && <NutritionSection />}
              {activeTab === "exercise" && <ExerciseSection />}
              {activeTab === "diabetes" && <DiabetesSection />}
              {activeTab === "goals" && <GoalsSection />}
            </main>
          </div>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
