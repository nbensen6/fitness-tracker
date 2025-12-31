// User profile with goals
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  // Basic stats
  currentWeight?: number; // in lbs
  heightFeet?: number;
  heightInches?: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  // Goals
  calorieGoal: number;
  goalWeight?: number; // in lbs
  goalWeeks?: number; // weeks to reach goal
  goalType?: 'lose' | 'maintain' | 'gain';
  // Optional macros (in grams)
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
  // Profile picture
  profilePicture?: string;
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

// Calorie calculation result
export interface CalorieCalculation {
  bmr: number; // Base Metabolic Rate
  tdee: number; // Total Daily Energy Expenditure
  targetCalories: number; // Recommended daily calories for goal
  deficit: number; // Daily calorie deficit/surplus
  weeklyChange: number; // Expected weekly weight change in lbs
}

// Serving unit types
export type ServingUnit = 'g' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'ml';

// Calorie tracking
export interface FoodItem {
  id: string;
  name: string;
  calories: number; // per serving
  protein: number; // per serving
  carbs: number; // per serving
  fat: number; // per serving
  servingSize: string; // display string like "1 cup (80g)"
  servingGrams: number; // grams per serving (base unit for calculations)
  defaultUnit: ServingUnit; // default unit for this food
  availableUnits?: ServingUnit[]; // units that make sense for this food
  gramsPerCup?: number; // grams per cup for this specific food (overrides default 240g)
}

export interface MealEntry {
  id: string;
  userId: string;
  foodItem: FoodItem;
  quantity: number; // amount in the specified unit
  unit: ServingUnit; // unit used for this entry
  gramsConsumed: number; // actual grams consumed (for accurate calorie calc)
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  timestamp: Date;
}

// Recipe ingredient
export interface RecipeIngredient {
  foodItem: FoodItem;
  quantity: number;
  unit: ServingUnit;
  gramsConsumed: number;
}

// Saved recipe (combination of foods)
export interface Recipe {
  id: string;
  userId: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  defaultMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  createdAt: Date;
}

// Workout tracking
export interface Exercise {
  id: string;
  name: string;
  category: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio';
  equipment: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string;
  muscleGroups?: string[];
}

export interface ExerciseSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface WorkoutExercise {
  exercise: Exercise;
  sets: ExerciseSet[];
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  exercises: WorkoutExercise[];
  date: string;
  duration: number;
  timestamp: Date;
  completed: boolean;
}

// Workout plans
export interface WorkoutPlanDay {
  dayNumber: number;
  name: string;
  exercises: {
    exercise: Exercise;
    targetSets: number;
    targetReps: string;
  }[];
  isRestDay: boolean;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  days: WorkoutPlanDay[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserWorkoutPlan {
  id: string;
  userId: string;
  planId: string;
  plan: WorkoutPlan;
  startDate: string;
  currentDay: number;
  completedDays: number[];
}
