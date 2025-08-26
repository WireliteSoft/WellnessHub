import React, { useState } from 'react';
import { Apple, Clock, Zap, Heart } from 'lucide-react';
import { foodRecommendations } from '../data/mockData';

const NutritionSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'>('all');

  const categories = [
    { id: 'all', label: 'All Foods', icon: Apple },
    { id: 'breakfast', label: 'Breakfast', icon: Clock },
    { id: 'lunch', label: 'Lunch', icon: Zap },
    { id: 'dinner', label: 'Dinner', icon: Heart },
    { id: 'snack', label: 'Snacks', icon: Apple }
  ];

  const filteredRecommendations = selectedCategory === 'all' 
    ? foodRecommendations 
    : foodRecommendations.filter(food => food.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Nutrition Guidance</h1>
        <p className="text-gray-600 dark:text-gray-300">Discover healthy, diabetes-friendly meal options tailored for you.</p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((category) => {
          const IconComponent = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <IconComponent className="h-4 w-4" />
              <span>{category.label}</span>
            </button>
          );
        })}
      </div>

      {/* Food Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecommendations.map((food) => (
          <div key={food.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{food.name}</h3>
                {food.diabeticFriendly && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Diabetic Friendly
                  </span>
                )}
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{food.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{food.calories}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Calories</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{food.protein}g</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Protein</p>
                </div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span>Carbs: {food.carbs}g</span>
                <span>Fiber: {food.fiber}g</span>
              </div>
              
              <button className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2 px-4 rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200">
                Add to Meal Plan
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Nutrition Summary */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Nutrition Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-600">1,245</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Calories</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Goal: 1,800</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-2xl font-bold text-emerald-600">89g</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Protein</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Goal: 120g</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-2xl font-bold text-orange-600">145g</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Carbs</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Goal: 180g</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <p className="text-2xl font-bold text-purple-600">18g</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Fiber</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Goal: 25g</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutritionSection;