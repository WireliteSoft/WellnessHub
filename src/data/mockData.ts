import { FoodRecommendation, Exercise, Goal, BloodGlucoseReading } from '../types';

export const foodRecommendations: FoodRecommendation[] = [
  {
    id: '1',
    name: 'Greek Yogurt with Berries',
    category: 'breakfast',
    diabeticFriendly: true,
    calories: 150,
    carbs: 18,
    protein: 15,
    fiber: 3,
    description: 'High protein breakfast with antioxidants and probiotics'
  },
  {
    id: '2',
    name: 'Grilled Salmon with Vegetables',
    category: 'dinner',
    diabeticFriendly: true,
    calories: 350,
    carbs: 12,
    protein: 32,
    fiber: 8,
    description: 'Omega-3 rich fish with fiber-packed vegetables'
  },
  {
    id: '3',
    name: 'Quinoa Bowl with Chickpeas',
    category: 'lunch',
    diabeticFriendly: true,
    calories: 320,
    carbs: 45,
    protein: 14,
    fiber: 8,
    description: 'Complete protein with complex carbohydrates'
  },
  {
    id: '4',
    name: 'Mixed Nuts (1 oz)',
    category: 'snack',
    diabeticFriendly: true,
    calories: 170,
    carbs: 6,
    protein: 6,
    fiber: 3,
    description: 'Healthy fats and protein for sustained energy'
  }
];

export const exercises: Exercise[] = [];

export const mockGoals: Goal[] = [
  {
    id: '1',
    title: 'Daily Water Intake',
    description: 'Drink 8 glasses of water daily',
    category: 'nutrition',
    target: 8,
    current: 5,
    unit: 'glasses',
    deadline: '2025-01-31',
    completed: false
  },
  {
    id: '2',
    title: 'Weekly Exercise',
    description: 'Exercise 5 times per week',
    category: 'exercise',
    target: 5,
    current: 3,
    unit: 'sessions',
    deadline: '2025-01-31',
    completed: false
  },
  {
    id: '3',
    title: 'Blood Sugar Control',
    description: 'Keep average blood glucose under 140 mg/dL',
    category: 'diabetes',
    target: 140,
    current: 155,
    unit: 'mg/dL',
    deadline: '2025-02-28',
    completed: false
  }
];

export const mockBloodGlucoseReadings: BloodGlucoseReading[] = [
  {
    id: '1',
    value: 95,
    timestamp: '2025-01-15T07:00:00Z',
    mealContext: 'fasting',
    notes: 'Morning reading'
  },
  {
    id: '2',
    value: 140,
    timestamp: '2025-01-15T13:30:00Z',
    mealContext: 'after-meal',
    notes: 'After lunch'
  },
  {
    id: '3',
    value: 105,
    timestamp: '2025-01-15T22:00:00Z',
    mealContext: 'bedtime',
    notes: 'Before bed'
  }
];