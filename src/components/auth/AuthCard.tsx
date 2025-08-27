import React from "react";

export const AuthCard: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string }>> = ({ title, subtitle, children }) => {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-md">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  );
};