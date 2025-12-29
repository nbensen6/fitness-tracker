import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ImageBackground, View as RNView } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { searchFoods, commonFoods } from '@/services/foodApi';
import { addMealEntry, getMealsByDate, deleteMealEntry } from '@/services/firestore';
import { FoodItem, MealEntry } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function CaloriesScreen() {
  const { userId, isSignedIn, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [searching, setSearching] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const calorieGoal = userProfile?.calorieGoal || 2000;

  useEffect(() => {
    if (userId) {
      loadTodayMeals();
    }
  }, [userId]);

  const loadTodayMeals = async () => {
    if (!userId) return;
    try {
      const meals = await getMealsByDate(userId, today);
      setTodayMeals(meals);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(commonFoods);
      return;
    }

    setSearching(true);
    try {
      const results = await searchFoods(searchQuery);
      setSearchResults(results.length > 0 ? results : commonFoods);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults(commonFoods);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFood = async (food: FoodItem) => {
    if (!userId) {
      Alert.alert('Please sign in', 'You need to sign in to log food.');
      return;
    }

    try {
      await addMealEntry(userId, {
        foodItem: food,
        quantity: 1,
        mealType: selectedMealType,
        date: today,
      });
      loadTodayMeals();
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('Success', `${food.name} added to ${selectedMealType}`);
    } catch (error) {
      console.error('Error adding food:', error);
      Alert.alert('Error', 'Failed to add food');
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMealEntry(mealId);
      loadTodayMeals();
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const totalCalories = todayMeals.reduce(
    (sum, meal) => sum + (meal.foodItem.calories * meal.quantity),
    0
  );

  const remainingCalories = calorieGoal - totalCalories;
  const calorieProgress = Math.min((totalCalories / calorieGoal) * 100, 100);

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const getMealsByType = (type: MealType) =>
    todayMeals.filter((meal) => meal.mealType === type);

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={styles.messageContainer}>
          <Text style={styles.message}>Please sign in to track calories</Text>
        </RNView>
      </LinearGradient>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/nutrition-spread.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <RNView style={styles.overlay}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <RNView style={styles.container}>
            {/* Header */}
            <Text style={styles.title}>Calories</Text>

            {/* Total Calories Card */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.totalCard}>
              <RNView style={styles.totalHeader}>
                <Text style={styles.totalLabel}>Today's Calories</Text>
                <Text style={styles.goalText}>{totalCalories} / {calorieGoal}</Text>
              </RNView>
              <RNView style={styles.progressBar}>
                <LinearGradient
                  colors={calorieProgress >= 100 ? ['#ff6b6b', '#e94560'] : ['#4ade80', '#22c55e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${calorieProgress}%` }]}
                />
              </RNView>
              <RNView style={styles.statsRow}>
                <RNView style={styles.statItem}>
                  <Text style={styles.statValue}>{totalCalories}</Text>
                  <Text style={styles.statLabel}>Eaten</Text>
                </RNView>
                <RNView style={styles.statDivider} />
                <RNView style={styles.statItem}>
                  <Text style={[styles.statValue, remainingCalories < 0 && styles.negative]}>
                    {Math.abs(remainingCalories)}
                  </Text>
                  <Text style={styles.statLabel}>{remainingCalories >= 0 ? 'Left' : 'Over'}</Text>
                </RNView>
              </RNView>
            </LinearGradient>

            {/* Search Section */}
            <RNView style={styles.searchSection}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search food..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={handleSearch}>
                <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.searchButton}>
                  <Text style={styles.searchButtonText}>Search</Text>
                </LinearGradient>
              </TouchableOpacity>
            </RNView>

            {/* Meal Type Selector */}
            <RNView style={styles.mealTypeSelector}>
              {mealTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeButton,
                    selectedMealType === type && styles.mealTypeButtonActive,
                  ]}
                  onPress={() => setSelectedMealType(type)}
                >
                  <Text
                    style={[
                      styles.mealTypeText,
                      selectedMealType === type && styles.mealTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>

            {/* Search Results / Quick Add */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {searchQuery ? 'Search Results' : 'Quick Add'}
              </Text>
              {(searchResults.length > 0 ? searchResults : commonFoods).slice(0, 8).map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.foodItem}
                  onPress={() => handleAddFood(food)}
                >
                  <RNView style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={styles.foodMacros}>
                      P: {food.protein}g | C: {food.carbs}g | F: {food.fat}g
                    </Text>
                  </RNView>
                  <RNView style={styles.foodCalories}>
                    <Text style={styles.calorieValue}>{food.calories}</Text>
                    <Text style={styles.calorieLabel}>cal</Text>
                  </RNView>
                </TouchableOpacity>
              ))}
            </LinearGradient>

            {/* Today's Log */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Log</Text>
              {mealTypes.map((type) => {
                const meals = getMealsByType(type);
                if (meals.length === 0) return null;

                return (
                  <RNView key={type} style={styles.mealGroup}>
                    <Text style={styles.mealGroupTitle}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                    {meals.map((meal) => (
                      <RNView key={meal.id} style={styles.loggedMeal}>
                        <RNView style={styles.loggedMealInfo}>
                          <Text style={styles.loggedMealName}>
                            {meal.foodItem.name}
                          </Text>
                          <Text style={styles.loggedMealCalories}>
                            {meal.foodItem.calories * meal.quantity} cal
                          </Text>
                        </RNView>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteMeal(meal.id)}
                        >
                          <Text style={styles.deleteButtonText}>X</Text>
                        </TouchableOpacity>
                      </RNView>
                    ))}
                  </RNView>
                );
              })}
              {todayMeals.length === 0 && (
                <Text style={styles.emptyText}>No meals logged today</Text>
              )}
            </LinearGradient>
          </RNView>
        </ScrollView>
      </RNView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.92)',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: '#94a3b8',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  totalCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  goalText: {
    color: '#64748b',
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#374151',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  negative: {
    color: '#ef4444',
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchButton: {
    borderRadius: 10,
    padding: 14,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  mealTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 4,
  },
  mealTypeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  mealTypeButtonActive: {
    backgroundColor: '#e94560',
  },
  mealTypeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  mealTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#fff',
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  foodMacros: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  foodCalories: {
    alignItems: 'center',
  },
  calorieValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  calorieLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  mealGroup: {
    marginBottom: 16,
  },
  mealGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  loggedMeal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  loggedMealInfo: {
    flex: 1,
  },
  loggedMealName: {
    fontSize: 14,
    color: '#fff',
  },
  loggedMealCalories: {
    fontSize: 12,
    color: '#4ade80',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 20,
  },
});
