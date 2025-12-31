import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View as RNView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { getMealsByDate, deleteMealEntry } from '@/services/firestore';
import { calculateNutrition } from '@/services/foodApi';
import { MealEntry } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Helper to get start and end of week (Sunday to Saturday)
const getWeekDates = (date: Date) => {
  const current = new Date(date);
  const dayOfWeek = current.getDay();
  const startOfWeek = new Date(current);
  startOfWeek.setDate(current.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return { startOfWeek, endOfWeek };
};

// Get all days of the week
const getWeekDays = (startOfWeek: Date) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
};

// Format date to ISO string (YYYY-MM-DD)
const formatDateToISO = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Format date for display
const formatDateDisplay = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Format week range for header
const formatWeekRange = (startOfWeek: Date, endOfWeek: Date) => {
  const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startMonth} - ${endMonth}`;
};

export default function WeeklyLogScreen() {
  const { userId, isSignedIn, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const { startOfWeek } = getWeekDates(new Date());
    return startOfWeek;
  });
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const calorieGoal = userProfile?.calorieGoal || 2000;
  const weekDays = getWeekDays(currentWeekStart);
  const endOfWeek = new Date(currentWeekStart);
  endOfWeek.setDate(currentWeekStart.getDate() + 6);

  useEffect(() => {
    if (userId) {
      loadWeeklyMeals();
    } else {
      setLoading(false);
    }
  }, [userId, currentWeekStart]);

  const loadWeeklyMeals = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch meals for each day of the week individually (uses existing index)
      const mealPromises = weekDays.map(day =>
        getMealsByDate(userId, formatDateToISO(day))
      );
      const dailyMeals = await Promise.all(mealPromises);
      const allMeals = dailyMeals.flat();
      setMeals(allMeals);
    } catch (error) {
      console.error('Error loading weekly meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const { startOfWeek } = getWeekDates(new Date());
    setCurrentWeekStart(startOfWeek);
  };

  const getMealsForDay = (date: Date) => {
    const dateStr = formatDateToISO(date);
    return meals.filter(meal => meal.date === dateStr);
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMealEntry(mealId);
      // Remove from local state immediately for responsive UI
      setMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealId));
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const getDayCalories = (date: Date) => {
    const dayMeals = getMealsForDay(date);
    return dayMeals.reduce((sum, meal) => {
      if (meal.gramsConsumed && meal.foodItem.servingGrams) {
        const nutrition = calculateNutrition(meal.foodItem, meal.gramsConsumed);
        return sum + nutrition.calories;
      }
      return sum + (meal.foodItem.calories * meal.quantity);
    }, 0);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDateToISO(date) === formatDateToISO(today);
  };

  const isCurrentWeek = () => {
    const { startOfWeek } = getWeekDates(new Date());
    return formatDateToISO(currentWeekStart) === formatDateToISO(startOfWeek);
  };

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={[styles.messageContainer, { paddingTop: insets.top }]}>
          <Text style={styles.message}>Please sign in to view your food history</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonAlt}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </RNView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
      <RNView style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <RNView style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/calories')} style={styles.backButton}>
            <Text style={styles.backArrow}>{"< Log"}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>History</Text>
          <RNView style={styles.headerSpacer} />
        </RNView>

        {/* Week Navigation */}
        <RNView style={styles.weekNav}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Text style={styles.navButtonText}>{"<"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToCurrentWeek}>
            <Text style={styles.weekRange}>{formatWeekRange(currentWeekStart, endOfWeek)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToNextWeek}
            style={[styles.navButton, isCurrentWeek() && styles.navButtonDisabled]}
            disabled={isCurrentWeek()}
          >
            <Text style={[styles.navButtonText, isCurrentWeek() && styles.navButtonTextDisabled]}>{">"}</Text>
          </TouchableOpacity>
        </RNView>

        {loading ? (
          <RNView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e94560" />
          </RNView>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {weekDays.map((day) => {
              const dateStr = formatDateToISO(day);
              const dayMeals = getMealsForDay(day);
              const dayCalories = getDayCalories(day);
              const isExpanded = expandedDay === dateStr;
              const progress = Math.min((dayCalories / calorieGoal) * 100, 100);

              return (
                <TouchableOpacity
                  key={dateStr}
                  onPress={() => setExpandedDay(isExpanded ? null : dateStr)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isToday(day) ? ['#2d3d54', '#1f2d3e'] : ['#2d2d44', '#1f1f2e']}
                    style={[styles.dayCard, isToday(day) && styles.todayCard]}
                  >
                    {/* Day Header */}
                    <RNView style={styles.dayHeader}>
                      <RNView>
                        <Text style={[styles.dayName, isToday(day) && styles.todayText]}>
                          {day.toLocaleDateString('en-US', { weekday: 'long' })}
                          {isToday(day) && ' (Today)'}
                        </Text>
                        <Text style={styles.dayDate}>{formatDateDisplay(day)}</Text>
                      </RNView>
                      <RNView style={styles.dayStats}>
                        <Text style={[styles.dayCalories, dayCalories > calorieGoal && styles.overGoal]}>
                          {dayCalories}
                        </Text>
                        <Text style={styles.dayGoal}>/ {calorieGoal} cal</Text>
                      </RNView>
                    </RNView>

                    {/* Progress Bar */}
                    <RNView style={styles.progressBar}>
                      <LinearGradient
                        colors={progress >= 100 ? ['#ff6b6b', '#e94560'] : ['#4ade80', '#22c55e']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${progress}%` }]}
                      />
                    </RNView>

                    {/* Meal Count */}
                    <Text style={styles.mealCount}>
                      {dayMeals.length === 0 ? 'No meals logged' : `${dayMeals.length} meal${dayMeals.length !== 1 ? 's' : ''} logged`}
                    </Text>

                    {/* Expanded Meal List */}
                    {isExpanded && dayMeals.length > 0 && (
                      <RNView style={styles.mealList}>
                        {dayMeals.map((meal) => {
                          const mealCalories = meal.gramsConsumed && meal.foodItem.servingGrams
                            ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                            : meal.foodItem.calories * meal.quantity;
                          const displayAmount = meal.unit
                            ? `${meal.quantity} ${meal.unit}`
                            : `${meal.quantity} serving`;
                          return (
                            <RNView key={meal.id} style={styles.mealItem}>
                              <RNView style={styles.mealInfo}>
                                <Text style={styles.mealName}>{meal.foodItem.name}</Text>
                                <Text style={styles.mealDetails}>
                                  {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)} - {displayAmount}
                                </Text>
                              </RNView>
                              <RNView style={styles.mealRight}>
                                <Text style={styles.mealCalories}>{mealCalories} cal</Text>
                                <TouchableOpacity
                                  style={styles.deleteButton}
                                  onPress={() => handleDeleteMeal(meal.id)}
                                >
                                  <Text style={styles.deleteButtonText}>X</Text>
                                </TouchableOpacity>
                              </RNView>
                            </RNView>
                          );
                        })}
                      </RNView>
                    )}

                    {/* Expand Indicator */}
                    {dayMeals.length > 0 && (
                      <Text style={styles.expandIndicator}>
                        {isExpanded ? 'Tap to collapse' : 'Tap to view meals'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {/* Weekly Summary */}
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Weekly Summary</Text>
              <RNView style={styles.summaryRow}>
                <RNView style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {weekDays.reduce((sum, day) => sum + getDayCalories(day), 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>Total Calories</Text>
                </RNView>
                <RNView style={styles.summaryDivider} />
                <RNView style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Math.round(weekDays.reduce((sum, day) => sum + getDayCalories(day), 0) / 7)}
                  </Text>
                  <Text style={styles.summaryLabel}>Daily Average</Text>
                </RNView>
              </RNView>
            </LinearGradient>

            <RNView style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </RNView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  backButtonAlt: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#64748b',
  },
  weekRange: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  todayCard: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  todayText: {
    color: '#3b82f6',
  },
  dayDate: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  dayStats: {
    alignItems: 'flex-end',
  },
  dayCalories: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4ade80',
  },
  overGoal: {
    color: '#ef4444',
  },
  dayGoal: {
    fontSize: 12,
    color: '#64748b',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  mealCount: {
    fontSize: 13,
    color: '#64748b',
  },
  mealList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 12,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  mealDetails: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
  },
  mealRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  expandIndicator: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 40,
  },
});
