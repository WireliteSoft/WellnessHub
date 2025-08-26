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