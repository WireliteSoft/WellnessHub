// src/sections/admin/AdminPanel.tsx
import React, { useState } from "react";
import { Users, BookOpen, ListOrdered, Globe } from "lucide-react";
import AdminRecipes from "../../components/admin/AdminRecipes";
import AdminUsers from "./AdminUsers";
import AdminRecipesList from "./AdminRecipesList";
import AdminImportRecipes from "./AdminRecipesImport"; // <-- NEW

type Tab = "recipes" | "recipesList" | "users" | "import";

const AdminPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>("recipes");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "recipes", label: "Add Recipe", icon: BookOpen },
    { id: "recipesList", label: "Manage Recipes", icon: ListOrdered },
    { id: "users", label: "Users", icon: Users },
    { id: "import", label: "Import", icon: Globe }, // <-- NEW
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin</h1>
        <div className="flex gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white"
                    : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div>
        {tab === "recipes" && <AdminRecipes />}
        {tab === "recipesList" && <AdminRecipesList />}
        {tab === "users" && <AdminUsers />}
        {tab === "import" && <AdminRecipesImport />}{/* <-- NEW */}
      </div>
    </div>
  );
};

export default AdminPanel;
