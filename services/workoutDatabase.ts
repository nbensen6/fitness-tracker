import { Exercise, WorkoutPlan, WorkoutPlanDay } from '../types';

// Comprehensive exercise database organized by muscle group and difficulty
export const EXERCISES: Exercise[] = [
  // CHEST
  { id: 'chest-1', name: 'Push-ups', category: 'chest', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  { id: 'chest-2', name: 'Incline Push-ups', category: 'chest', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest', 'triceps'] },
  { id: 'chest-3', name: 'Dumbbell Bench Press', category: 'chest', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  { id: 'chest-4', name: 'Dumbbell Flyes', category: 'chest', equipment: 'dumbbells', difficulty: 'intermediate', muscleGroups: ['chest'] },
  { id: 'chest-5', name: 'Barbell Bench Press', category: 'chest', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  { id: 'chest-6', name: 'Incline Barbell Press', category: 'chest', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders'] },
  { id: 'chest-7', name: 'Cable Crossovers', category: 'chest', equipment: 'cables', difficulty: 'intermediate', muscleGroups: ['chest'] },
  { id: 'chest-8', name: 'Decline Bench Press', category: 'chest', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['chest', 'triceps'] },
  { id: 'chest-9', name: 'Weighted Dips', category: 'chest', equipment: 'weighted', difficulty: 'advanced', muscleGroups: ['chest', 'triceps', 'shoulders'] },

  // BACK
  { id: 'back-1', name: 'Lat Pulldowns', category: 'back', equipment: 'cable machine', difficulty: 'beginner', muscleGroups: ['lats', 'biceps'] },
  { id: 'back-2', name: 'Seated Cable Rows', category: 'back', equipment: 'cable machine', difficulty: 'beginner', muscleGroups: ['lats', 'rhomboids', 'biceps'] },
  { id: 'back-3', name: 'Dumbbell Rows', category: 'back', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['lats', 'rhomboids', 'biceps'] },
  { id: 'back-4', name: 'Assisted Pull-ups', category: 'back', equipment: 'assisted machine', difficulty: 'beginner', muscleGroups: ['lats', 'biceps'] },
  { id: 'back-5', name: 'Barbell Rows', category: 'back', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['lats', 'rhomboids', 'biceps'] },
  { id: 'back-6', name: 'Pull-ups', category: 'back', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['lats', 'biceps'] },
  { id: 'back-7', name: 'T-Bar Rows', category: 'back', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['lats', 'rhomboids'] },
  { id: 'back-8', name: 'Deadlifts', category: 'back', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['lats', 'lower back', 'glutes', 'hamstrings'] },
  { id: 'back-9', name: 'Weighted Pull-ups', category: 'back', equipment: 'weighted', difficulty: 'advanced', muscleGroups: ['lats', 'biceps'] },

  // SHOULDERS
  { id: 'shoulders-1', name: 'Dumbbell Shoulder Press', category: 'shoulders', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['shoulders', 'triceps'] },
  { id: 'shoulders-2', name: 'Lateral Raises', category: 'shoulders', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['shoulders'] },
  { id: 'shoulders-3', name: 'Front Raises', category: 'shoulders', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['shoulders'] },
  { id: 'shoulders-4', name: 'Rear Delt Flyes', category: 'shoulders', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['shoulders'] },
  { id: 'shoulders-5', name: 'Barbell Overhead Press', category: 'shoulders', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['shoulders', 'triceps'] },
  { id: 'shoulders-6', name: 'Arnold Press', category: 'shoulders', equipment: 'dumbbells', difficulty: 'intermediate', muscleGroups: ['shoulders', 'triceps'] },
  { id: 'shoulders-7', name: 'Face Pulls', category: 'shoulders', equipment: 'cables', difficulty: 'intermediate', muscleGroups: ['shoulders', 'upper back'] },
  { id: 'shoulders-8', name: 'Push Press', category: 'shoulders', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['shoulders', 'triceps', 'legs'] },

  // ARMS (Biceps & Triceps)
  { id: 'arms-1', name: 'Dumbbell Bicep Curls', category: 'arms', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['biceps'] },
  { id: 'arms-2', name: 'Tricep Pushdowns', category: 'arms', equipment: 'cables', difficulty: 'beginner', muscleGroups: ['triceps'] },
  { id: 'arms-3', name: 'Hammer Curls', category: 'arms', equipment: 'dumbbells', difficulty: 'beginner', muscleGroups: ['biceps', 'forearms'] },
  { id: 'arms-4', name: 'Tricep Dips (Bench)', category: 'arms', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['triceps'] },
  { id: 'arms-5', name: 'Barbell Curls', category: 'arms', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['biceps'] },
  { id: 'arms-6', name: 'Skull Crushers', category: 'arms', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['triceps'] },
  { id: 'arms-7', name: 'Preacher Curls', category: 'arms', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['biceps'] },
  { id: 'arms-8', name: 'Close-Grip Bench Press', category: 'arms', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['triceps', 'chest'] },

  // LEGS
  { id: 'legs-1', name: 'Bodyweight Squats', category: 'legs', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['quads', 'glutes'] },
  { id: 'legs-2', name: 'Leg Press', category: 'legs', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['quads', 'glutes'] },
  { id: 'legs-3', name: 'Leg Curls', category: 'legs', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['hamstrings'] },
  { id: 'legs-4', name: 'Leg Extensions', category: 'legs', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['quads'] },
  { id: 'legs-5', name: 'Lunges', category: 'legs', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['quads', 'glutes'] },
  { id: 'legs-6', name: 'Goblet Squats', category: 'legs', equipment: 'dumbbells', difficulty: 'intermediate', muscleGroups: ['quads', 'glutes'] },
  { id: 'legs-7', name: 'Romanian Deadlifts', category: 'legs', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['hamstrings', 'glutes'] },
  { id: 'legs-8', name: 'Barbell Squats', category: 'legs', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  { id: 'legs-9', name: 'Bulgarian Split Squats', category: 'legs', equipment: 'dumbbells', difficulty: 'intermediate', muscleGroups: ['quads', 'glutes'] },
  { id: 'legs-10', name: 'Front Squats', category: 'legs', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['quads', 'core'] },
  { id: 'legs-11', name: 'Hip Thrusts', category: 'legs', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['glutes', 'hamstrings'] },

  // CORE
  { id: 'core-1', name: 'Plank', category: 'core', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core'] },
  { id: 'core-2', name: 'Crunches', category: 'core', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['abs'] },
  { id: 'core-3', name: 'Dead Bug', category: 'core', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core'] },
  { id: 'core-4', name: 'Mountain Climbers', category: 'core', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core', 'shoulders'] },
  { id: 'core-5', name: 'Russian Twists', category: 'core', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['obliques'] },
  { id: 'core-6', name: 'Hanging Leg Raises', category: 'core', equipment: 'pull-up bar', difficulty: 'intermediate', muscleGroups: ['abs', 'hip flexors'] },
  { id: 'core-7', name: 'Cable Woodchops', category: 'core', equipment: 'cables', difficulty: 'intermediate', muscleGroups: ['obliques', 'core'] },
  { id: 'core-8', name: 'Ab Wheel Rollouts', category: 'core', equipment: 'ab wheel', difficulty: 'advanced', muscleGroups: ['core', 'lats'] },
  { id: 'core-9', name: 'Dragon Flags', category: 'core', equipment: 'bodyweight', difficulty: 'advanced', muscleGroups: ['core'] },

  // CARDIO
  { id: 'cardio-1', name: 'Walking', category: 'cardio', equipment: 'none', difficulty: 'beginner', muscleGroups: [] },
  { id: 'cardio-2', name: 'Stationary Bike', category: 'cardio', equipment: 'bike', difficulty: 'beginner', muscleGroups: ['legs'] },
  { id: 'cardio-3', name: 'Elliptical', category: 'cardio', equipment: 'elliptical', difficulty: 'beginner', muscleGroups: ['legs', 'arms'] },
  { id: 'cardio-4', name: 'Jogging', category: 'cardio', equipment: 'none', difficulty: 'intermediate', muscleGroups: ['legs'] },
  { id: 'cardio-5', name: 'Rowing Machine', category: 'cardio', equipment: 'rower', difficulty: 'intermediate', muscleGroups: ['back', 'legs', 'arms'] },
  { id: 'cardio-6', name: 'Jump Rope', category: 'cardio', equipment: 'jump rope', difficulty: 'intermediate', muscleGroups: ['calves', 'shoulders'] },
  { id: 'cardio-7', name: 'Stair Climber', category: 'cardio', equipment: 'stair climber', difficulty: 'intermediate', muscleGroups: ['legs', 'glutes'] },
  { id: 'cardio-8', name: 'HIIT Sprints', category: 'cardio', equipment: 'none', difficulty: 'advanced', muscleGroups: ['legs'] },
  { id: 'cardio-9', name: 'Battle Ropes', category: 'cardio', equipment: 'battle ropes', difficulty: 'advanced', muscleGroups: ['arms', 'shoulders', 'core'] },
];

// Get exercises by difficulty level
export function getExercisesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Exercise[] {
  return EXERCISES.filter(e => e.difficulty === difficulty);
}

// Get exercises by category
export function getExercisesByCategory(category: string): Exercise[] {
  return EXERCISES.filter(e => e.category === category);
}

// Get exercises by category and max difficulty
export function getExercisesForLevel(
  category: string,
  maxDifficulty: 'beginner' | 'intermediate' | 'advanced'
): Exercise[] {
  const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
  const maxIndex = difficultyOrder.indexOf(maxDifficulty);

  return EXERCISES.filter(
    e => e.category === category && difficultyOrder.indexOf(e.difficulty || 'beginner') <= maxIndex
  );
}

// Search exercises by name
export function searchExercises(query: string): Exercise[] {
  const lowerQuery = query.toLowerCase();
  return EXERCISES.filter(e => e.name.toLowerCase().includes(lowerQuery));
}

// Pre-built workout plans organized by difficulty
export const WORKOUT_PLANS: WorkoutPlan[] = [
  // BEGINNER PLANS
  {
    id: 'beginner-fullbody',
    name: 'Beginner Full Body',
    description: 'Perfect for beginners. Full body workout 3 days per week with rest days between.',
    daysPerWeek: 3,
    difficulty: 'beginner',
    days: [
      {
        dayNumber: 1,
        name: 'Full Body A',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-1')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'chest-1')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'back-3')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-2')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-1')!, targetSets: 3, targetReps: '30 sec' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
      {
        dayNumber: 3,
        name: 'Full Body B',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'chest-3')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'back-1')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-1')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-2')!, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
      {
        dayNumber: 5,
        name: 'Full Body C',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-5')!, targetSets: 3, targetReps: '10 each' },
          { exercise: EXERCISES.find(e => e.id === 'back-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-1')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'core-2')!, targetSets: 3, targetReps: '15-20' },
          { exercise: EXERCISES.find(e => e.id === 'cardio-1')!, targetSets: 1, targetReps: '15 min' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
      {
        dayNumber: 7,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
    ],
  },

  // INTERMEDIATE PLANS
  {
    id: 'intermediate-ppl',
    name: 'Push Pull Legs',
    description: 'Classic PPL split for intermediate lifters. 6 days per week for maximum gains.',
    daysPerWeek: 6,
    difficulty: 'intermediate',
    days: [
      {
        dayNumber: 1,
        name: 'Push (Chest, Shoulders, Triceps)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-5')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'chest-6')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-5')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-2')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'arms-6')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-2')!, targetSets: 3, targetReps: '12-15' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Pull (Back, Biceps)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'back-8')!, targetSets: 4, targetReps: '5-6' },
          { exercise: EXERCISES.find(e => e.id === 'back-5')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'back-6')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-7')!, targetSets: 3, targetReps: '15-20' },
          { exercise: EXERCISES.find(e => e.id === 'arms-5')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-3')!, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-8')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'legs-7')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'legs-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-3')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-4')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-6')!, targetSets: 3, targetReps: '10-15' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Push (Chest, Shoulders, Triceps)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-3')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'chest-7')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-6')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-4')!, targetSets: 3, targetReps: '15-20' },
          { exercise: EXERCISES.find(e => e.id === 'arms-8')!, targetSets: 3, targetReps: '8-10' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Pull (Back, Biceps)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'back-1')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'back-7')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'back-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-7')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-1')!, targetSets: 3, targetReps: '12-15' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Legs',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-10')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'legs-9')!, targetSets: 3, targetReps: '10 each' },
          { exercise: EXERCISES.find(e => e.id === 'legs-11')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-3')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-5')!, targetSets: 3, targetReps: '20 each' },
        ],
      },
      {
        dayNumber: 7,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
    ],
  },
  {
    id: 'intermediate-upper-lower',
    name: 'Upper Lower Split',
    description: 'Great balance of volume and recovery. 4 days per week hitting each muscle twice.',
    daysPerWeek: 4,
    difficulty: 'intermediate',
    days: [
      {
        dayNumber: 1,
        name: 'Upper Body A',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-5')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'back-5')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-5')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'arms-5')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-6')!, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Lower Body A',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-8')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'legs-7')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'legs-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-3')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-1')!, targetSets: 3, targetReps: '45 sec' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
      {
        dayNumber: 4,
        name: 'Upper Body B',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-3')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'back-6')!, targetSets: 4, targetReps: '6-10' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-2')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'chest-4')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'arms-3')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-2')!, targetSets: 3, targetReps: '12-15' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Lower Body B',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-6')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-9')!, targetSets: 3, targetReps: '10 each' },
          { exercise: EXERCISES.find(e => e.id === 'legs-11')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-4')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-6')!, targetSets: 3, targetReps: '10-15' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
      {
        dayNumber: 7,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
    ],
  },

  // ADVANCED PLANS
  {
    id: 'advanced-ppl',
    name: 'Advanced PPL',
    description: 'High volume PPL for experienced lifters. Heavy compounds with isolation work.',
    daysPerWeek: 6,
    difficulty: 'advanced',
    days: [
      {
        dayNumber: 1,
        name: 'Push (Heavy)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-5')!, targetSets: 5, targetReps: '5' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-8')!, targetSets: 4, targetReps: '5-6' },
          { exercise: EXERCISES.find(e => e.id === 'chest-6')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'chest-7')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-2')!, targetSets: 4, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'chest-9')!, targetSets: 3, targetReps: '8-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-6')!, targetSets: 4, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Pull (Heavy)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'back-8')!, targetSets: 5, targetReps: '5' },
          { exercise: EXERCISES.find(e => e.id === 'back-9')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'back-5')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'back-7')!, targetSets: 3, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-7')!, targetSets: 4, targetReps: '15-20' },
          { exercise: EXERCISES.find(e => e.id === 'arms-5')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'arms-3')!, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs (Heavy)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-8')!, targetSets: 5, targetReps: '5' },
          { exercise: EXERCISES.find(e => e.id === 'legs-10')!, targetSets: 4, targetReps: '6-8' },
          { exercise: EXERCISES.find(e => e.id === 'legs-7')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'legs-2')!, targetSets: 3, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-3')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'core-8')!, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Push (Volume)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'chest-3')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'chest-8')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'chest-4')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-6')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-4')!, targetSets: 3, targetReps: '15-20' },
          { exercise: EXERCISES.find(e => e.id === 'arms-8')!, targetSets: 4, targetReps: '8-10' },
          { exercise: EXERCISES.find(e => e.id === 'arms-2')!, targetSets: 3, targetReps: '15-20' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Pull (Volume)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'back-1')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'back-2')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'back-6')!, targetSets: 4, targetReps: '8-12' },
          { exercise: EXERCISES.find(e => e.id === 'shoulders-3')!, targetSets: 3, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'arms-7')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'arms-1')!, targetSets: 3, targetReps: '12-15' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Legs (Volume)',
        isRestDay: false,
        exercises: [
          { exercise: EXERCISES.find(e => e.id === 'legs-6')!, targetSets: 4, targetReps: '10-12' },
          { exercise: EXERCISES.find(e => e.id === 'legs-9')!, targetSets: 4, targetReps: '10 each' },
          { exercise: EXERCISES.find(e => e.id === 'legs-11')!, targetSets: 4, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'legs-4')!, targetSets: 4, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'legs-3')!, targetSets: 4, targetReps: '12-15' },
          { exercise: EXERCISES.find(e => e.id === 'core-9')!, targetSets: 3, targetReps: '6-10' },
        ],
      },
      {
        dayNumber: 7,
        name: 'Rest Day',
        isRestDay: true,
        exercises: [],
      },
    ],
  },
];

// Get workout plans by difficulty
export function getWorkoutPlansByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): WorkoutPlan[] {
  return WORKOUT_PLANS.filter(p => p.difficulty === difficulty);
}

// Get all workout plans
export function getAllWorkoutPlans(): WorkoutPlan[] {
  return WORKOUT_PLANS;
}

// Get a specific workout plan by ID
export function getWorkoutPlanById(id: string): WorkoutPlan | undefined {
  return WORKOUT_PLANS.find(p => p.id === id);
}

// Get suggested plan based on user's experience level
export function getSuggestedPlan(daysPerWeek: number, difficulty: 'beginner' | 'intermediate' | 'advanced'): WorkoutPlan | undefined {
  const plansForLevel = getWorkoutPlansByDifficulty(difficulty);

  // Find plan closest to desired days per week
  return plansForLevel.reduce((closest, plan) => {
    if (!closest) return plan;
    const closestDiff = Math.abs(closest.daysPerWeek - daysPerWeek);
    const planDiff = Math.abs(plan.daysPerWeek - daysPerWeek);
    return planDiff < closestDiff ? plan : closest;
  }, undefined as WorkoutPlan | undefined);
}
