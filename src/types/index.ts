export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  isDiabetic: boolean;
  diabetesType?: 'type1' | 'type2';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  goals: Goal[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'nutrition' | 'exercise' | 'diabetes' | 'weight';
  target: number;
  current: number;
  unit: string;
  deadline: string;
  completed: boolean;
}

export interface FoodRecommendation {
  id: string;
  name: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  diabeticFriendly: boolean;
  calories: number;
  carbs: number;
  protein: number;
  fiber: number;
  description: string;
}

export interface Exercise {
  id: string;
  name: string;
  type: 'cardio' | 'strength' | 'flexibility' | 'balance';
  duration: number;
  intensity: 'low' | 'moderate' | 'high';
  diabeticSafe: boolean;
  bestTime: 'morning' | 'afternoon' | 'evening' | 'anytime';
  description: string;
}

export interface BloodGlucoseReading {
  id: string;
  value: number;
  timestamp: string;
  mealContext: 'fasting' | 'before-meal' | 'after-meal' | 'bedtime';
  notes?: string;
}

export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string; // e.g., "2 cups", "1 tbsp"
}

export interface NutritionFacts {
  calories: number;
  protein: number; // grams
  carbs: number;   // grams
  fat: number;     // grams
  fiber?: number;  // grams
  sugar?: number;  // grams
  sodium?: number; // mg
}

export interface Recipe {
  id: string;
  title: string;
  category: MealCategory;
  description?: string;
  ingredients: Ingredient[];
  nutrition: NutritionFacts;
  instructions: string[]; // step-by-step
  image?: string; // URL or data: URI
  createdAt: string; // ISO
  updatedAt: string; // ISO
}