import { UserProfile, CalorieCalculation } from '../types';

// Activity level multipliers for TDEE
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2, // Little or no exercise
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week
  active: 1.725, // Hard exercise 6-7 days/week
  very_active: 1.9, // Very hard exercise, physical job
};

/**
 * Calculate BMR using Mifflin-St Jeor Equation (most accurate)
 * Weight in lbs, height in inches, age in years
 */
export function calculateBMR(
  weightLbs: number,
  heightInches: number,
  age: number,
  gender: 'male' | 'female'
): number {
  // Convert to metric
  const weightKg = weightLbs * 0.453592;
  const heightCm = heightInches * 2.54;

  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: keyof typeof ACTIVITY_MULTIPLIERS
): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Calculate target calories based on goal
 * 1 lb of fat = 3500 calories
 * Safe weight loss: 0.5-2 lbs per week
 * Safe weight gain: 0.5-1 lb per week
 */
export function calculateTargetCalories(
  tdee: number,
  currentWeight: number,
  goalWeight: number,
  goalWeeks: number
): { targetCalories: number; deficit: number; weeklyChange: number } {
  const weightDifference = goalWeight - currentWeight; // negative = lose, positive = gain
  const totalCalorieChange = weightDifference * 3500; // total calories to lose/gain
  const dailyChange = totalCalorieChange / (goalWeeks * 7); // daily deficit/surplus

  // Cap at safe limits: max 1000 cal deficit, max 500 cal surplus
  const safeDailyChange = Math.max(-1000, Math.min(500, dailyChange));
  const targetCalories = Math.round(tdee + safeDailyChange);

  // Don't go below 1200 for women or 1500 for men (we'll use 1400 as middle ground)
  const safeMinimum = 1400;
  const finalCalories = Math.max(safeMinimum, targetCalories);

  return {
    targetCalories: finalCalories,
    deficit: Math.round(tdee - finalCalories),
    weeklyChange: Math.round((safeDailyChange * 7) / 3500 * 10) / 10, // lbs per week, 1 decimal
  };
}

/**
 * Full calorie calculation from user profile
 */
export function calculateCaloriesForUser(profile: UserProfile): CalorieCalculation | null {
  // Need these fields to calculate
  if (
    !profile.currentWeight ||
    !profile.heightFeet ||
    !profile.age ||
    !profile.gender ||
    !profile.activityLevel
  ) {
    return null;
  }

  const heightInches = (profile.heightFeet * 12) + (profile.heightInches || 0);
  const bmr = calculateBMR(profile.currentWeight, heightInches, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activityLevel);

  // If no goal weight set, just return maintenance
  if (!profile.goalWeight || !profile.goalWeeks) {
    return {
      bmr: Math.round(bmr),
      tdee,
      targetCalories: tdee,
      deficit: 0,
      weeklyChange: 0,
    };
  }

  const { targetCalories, deficit, weeklyChange } = calculateTargetCalories(
    tdee,
    profile.currentWeight,
    profile.goalWeight,
    profile.goalWeeks
  );

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    deficit,
    weeklyChange,
  };
}

/**
 * Calculate suggested macros based on calories and goal
 * Protein: 0.8-1g per lb of body weight for muscle preservation
 * Fat: 25-35% of calories
 * Carbs: remainder
 */
export function calculateSuggestedMacros(
  targetCalories: number,
  weightLbs: number,
  goalType: 'lose' | 'maintain' | 'gain'
): { protein: number; carbs: number; fat: number } {
  // Higher protein for muscle preservation during weight loss
  const proteinPerLb = goalType === 'lose' ? 1.0 : goalType === 'gain' ? 0.9 : 0.8;
  const protein = Math.round(weightLbs * proteinPerLb);
  const proteinCalories = protein * 4;

  // Fat: 25% for weight loss, 30% for maintenance/gain
  const fatPercent = goalType === 'lose' ? 0.25 : 0.30;
  const fatCalories = targetCalories * fatPercent;
  const fat = Math.round(fatCalories / 9);

  // Carbs: remainder
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbs = Math.round(carbCalories / 4);

  return { protein, carbs, fat };
}

/**
 * Get activity level description
 */
export function getActivityLevelDescription(level: string): string {
  const descriptions: Record<string, string> = {
    sedentary: 'Little or no exercise, desk job',
    light: 'Light exercise 1-3 days/week',
    moderate: 'Moderate exercise 3-5 days/week',
    active: 'Hard exercise 6-7 days/week',
    very_active: 'Very intense exercise, physical job',
  };
  return descriptions[level] || '';
}
