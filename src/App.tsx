import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NutritionSection from './components/NutritionSection';
import ExerciseSection from './components/ExerciseSection';
import DiabetesSection from './components/DiabetesSection';
import GoalsSection from './components/GoalsSection';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderActiveSection = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'nutrition':
        return <NutritionSection />;
      case 'exercise':
        return <ExerciseSection />;
      case 'diabetes':
        return <DiabetesSection />;
      case 'goals':
        return <GoalsSection />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Header 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="min-h-screen">
          {renderActiveSection()}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;