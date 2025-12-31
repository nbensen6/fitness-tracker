import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { MealEntry, Workout, UserWorkoutPlan, Recipe } from '../types';

// Meal entries
export const addMealEntry = async (userId: string, entry: Omit<MealEntry, 'id' | 'userId' | 'timestamp'>) => {
  const docRef = await addDoc(collection(db, 'meals'), {
    ...entry,
    userId,
    timestamp: Timestamp.now()
  });
  return docRef.id;
};

export const getMealsByDate = async (userId: string, date: string): Promise<MealEntry[]> => {
  const q = query(
    collection(db, 'meals'),
    where('userId', '==', userId),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as MealEntry[];
};

export const deleteMealEntry = async (mealId: string) => {
  await deleteDoc(doc(db, 'meals', mealId));
};

export const getMealsForDateRange = async (userId: string, startDate: string, endDate: string): Promise<MealEntry[]> => {
  const q = query(
    collection(db, 'meals'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as MealEntry[];
};

// Recipes
export const addRecipe = async (userId: string, recipe: Omit<Recipe, 'id' | 'userId' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, 'recipes'), {
    ...recipe,
    userId,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

export const getUserRecipes = async (userId: string): Promise<Recipe[]> => {
  const q = query(
    collection(db, 'recipes'),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const recipes = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Recipe[];

  // Sort client-side to avoid needing a composite index
  return recipes.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
};

export const deleteRecipe = async (recipeId: string) => {
  await deleteDoc(doc(db, 'recipes', recipeId));
};

export const updateRecipe = async (recipeId: string, updates: Partial<Omit<Recipe, 'id' | 'userId' | 'createdAt'>>) => {
  await updateDoc(doc(db, 'recipes', recipeId), updates);
};

// Workouts
export const addWorkout = async (userId: string, workout: Omit<Workout, 'id' | 'userId' | 'timestamp'>) => {
  const docRef = await addDoc(collection(db, 'workouts'), {
    ...workout,
    userId,
    timestamp: Timestamp.now()
  });
  return docRef.id;
};

export const getWorkoutsByDate = async (userId: string, date: string): Promise<Workout[]> => {
  const q = query(
    collection(db, 'workouts'),
    where('userId', '==', userId),
    where('date', '==', date)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Workout[];
};

export const getRecentWorkouts = async (userId: string, limit: number = 10): Promise<Workout[]> => {
  const q = query(
    collection(db, 'workouts'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Workout[];
};

export const updateWorkout = async (workoutId: string, updates: Partial<Workout>) => {
  await updateDoc(doc(db, 'workouts', workoutId), updates);
};

// User workout plans
export const setUserWorkoutPlan = async (userId: string, plan: Omit<UserWorkoutPlan, 'id' | 'userId'>) => {
  const docRef = await addDoc(collection(db, 'userPlans'), {
    ...plan,
    userId
  });
  return docRef.id;
};

export const getUserWorkoutPlan = async (userId: string): Promise<UserWorkoutPlan | null> => {
  const q = query(
    collection(db, 'userPlans'),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as UserWorkoutPlan;
};

export const updateUserWorkoutPlan = async (planId: string, updates: Partial<UserWorkoutPlan>) => {
  await updateDoc(doc(db, 'userPlans', planId), updates);
};

// Update user profile
export const updateUserProfile = async (userId: string, updates: Record<string, any>) => {
  await updateDoc(doc(db, 'users', userId), updates);
};
