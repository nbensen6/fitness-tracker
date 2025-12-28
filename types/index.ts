// User profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  calorieGoal: number;
  createdAt: Date;
}

// Calorie tracking
export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
}

export interface MealEntry {
  id: string;
  userId: string;
  foodItem: FoodItem;
  quantity: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  timestamp: Date;
}

// Workout tracking
export interface Exercise {
  id: string;
  name: string;
  category: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio';
  equipment: string;
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
