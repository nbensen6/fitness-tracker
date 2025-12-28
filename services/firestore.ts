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
import { MealEntry, Workout, UserWorkoutPlan } from '../types';

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
