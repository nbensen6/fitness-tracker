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
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { MealEntry, Workout, UserWorkoutPlan, Recipe, CommunityFood, ServingUnit } from '../types';

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
export const deleteRecipeGroup = async (userId: string, recipeGroupId: string) => {
  const q = query(
    collection(db, 'meals'),
    where('userId', '==', userId),
    where('recipeGroupId', '==', recipeGroupId)
  );
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
};

export const deleteMealsByType = async (userId: string, date: string, mealType: string) => {
  const q = query(
    collection(db, 'meals'),
    where('userId', '==', userId),
    where('date', '==', date),
    where('mealType', '==', mealType)
  );
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
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
  // Strip undefined values from nested objects (Firestore rejects undefined)
  const cleanedRecipe = JSON.parse(JSON.stringify(recipe));
  const docRef = await addDoc(collection(db, 'recipes'), {
    ...cleanedRecipe,
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
  // createdAt may be a Firestore Timestamp or a Date depending on source
  return recipes.sort((a, b) => {
    const dateA = (a.createdAt as any)?.toDate?.() || a.createdAt || new Date(0);
    const dateB = (b.createdAt as any)?.toDate?.() || b.createdAt || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
};

export const deleteRecipe = async (recipeId: string) => {
  await deleteDoc(doc(db, 'recipes', recipeId));
};

export const updateRecipe = async (recipeId: string, updates: Partial<Omit<Recipe, 'id' | 'userId' | 'createdAt'>>) => {
  // Strip undefined values from nested objects (Firestore rejects undefined)
  const cleanedUpdates = JSON.parse(JSON.stringify(updates));
  await updateDoc(doc(db, 'recipes', recipeId), cleanedUpdates);
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

// Custom workout plans
export const saveCustomPlan = async (userId: string, plan: any) => {
  const docRef = await addDoc(collection(db, 'customPlans'), {
    ...plan,
    userId,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

export const getUserCustomPlans = async (userId: string): Promise<any[]> => {
  const q = query(
    collection(db, 'customPlans'),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const deleteCustomPlan = async (planId: string) => {
  await deleteDoc(doc(db, 'customPlans', planId));
};

export const deleteUserWorkoutPlan = async (planId: string) => {
  await deleteDoc(doc(db, 'userPlans', planId));
};

// Community Foods - shared food database submitted by users
export const addCommunityFood = async (
  userId: string,
  food: {
    name: string;
    brand?: string;
    barcode?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
    servingGrams: number;
    defaultUnit: ServingUnit;
    availableUnits: ServingUnit[];
  }
) => {
  const docRef = await addDoc(collection(db, 'communityFoods'), {
    ...food,
    submittedBy: userId,
    submittedAt: Timestamp.now(),
    verified: false,
    useCount: 0
  });
  return docRef.id;
};

export const searchCommunityFoods = async (searchTerm: string): Promise<CommunityFood[]> => {
  // Firestore doesn't support full-text search, so fetch all and filter client-side
  const q = query(collection(db, 'communityFoods'));
  const snapshot = await getDocs(q);

  const lowerSearch = searchTerm.toLowerCase();
  const foods = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as CommunityFood))
    .filter(food =>
      food.name.toLowerCase().includes(lowerSearch) ||
      food.brand?.toLowerCase().includes(lowerSearch)
    )
    .sort((a, b) => b.useCount - a.useCount); // Sort by popularity

  return foods;
};

export const getCommunityFoodByBarcode = async (barcode: string): Promise<CommunityFood | null> => {
  const q = query(
    collection(db, 'communityFoods'),
    where('barcode', '==', barcode)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as CommunityFood;
};

export const incrementCommunityFoodUseCount = async (foodId: string) => {
  const foodRef = doc(db, 'communityFoods', foodId);
  await updateDoc(foodRef, {
    useCount: increment(1)
  });
};
