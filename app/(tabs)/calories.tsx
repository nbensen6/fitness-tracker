import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ImageBackground, View as RNView, Modal, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, useWindowDimensions, Animated, PanResponder } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { searchFoods, commonFoods, searchCommonFoods, convertToGrams, calculateNutrition } from '@/services/foodApi';
import { addMealEntry, getMealsByDate, deleteMealEntry, deleteRecipeGroup, deleteMealsByType } from '@/services/firestore';
import { FoodItem, MealEntry, ServingUnit } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Swipeable Row Component
const SwipeableRow = ({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if horizontal movement is dominant (2x more than vertical)
        const isHorizontalSwipe = Math.abs(gestureState.dx) > 15 &&
                                   Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
        return isHorizontalSwipe;
      },
      onPanResponderTerminationRequest: () => false, // Don't let ScrollView steal the gesture
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -100));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swipe complete - show delete
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
            friction: 8,
          }).start();
        } else {
          // Reset
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <RNView style={swipeStyles.container}>
      <RNView style={swipeStyles.deleteBackground}>
        <TouchableOpacity onPress={handleDelete} style={swipeStyles.deleteButton}>
          <Text style={swipeStyles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </RNView>
      <Animated.View
        style={[swipeStyles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </RNView>
  );
};

const swipeStyles = StyleSheet.create({
  container: {
    marginBottom: 6,
    overflow: 'hidden',
    borderRadius: 10,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
  },
});

export default function CaloriesScreen() {
  const { userId, isSignedIn, userProfile } = useAuth();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const containerMaxWidth = isWeb && width > 768 ? '50%' : '100%';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [searching, setSearching] = useState(false);

  // Quantity selector modal state
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState<ServingUnit>('g');

  // History dropdown state
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const calorieGoal = userProfile?.calorieGoal || 2000;

  useEffect(() => {
    if (userId) {
      loadTodayMeals();
    }
  }, [userId]);

  // Reload meals when screen gains focus (e.g., coming back from recipes)
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadTodayMeals();
      }
    }, [userId, today])
  );

  const loadTodayMeals = async () => {
    if (!userId) return;
    try {
      const meals = await getMealsByDate(userId, today);
      setTodayMeals(meals);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // Real-time search as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(commonFoods);
      return;
    }

    // Instantly filter local common foods
    const localResults = searchCommonFoods(searchQuery);
    setSearchResults(localResults.length > 0 ? localResults : []);

    // Debounce API search for when no local results
    if (localResults.length === 0) {
      const timeoutId = setTimeout(async () => {
        setSearching(true);
        try {
          const results = await searchFoods(searchQuery);
          setSearchResults(results.length > 0 ? results : []);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setSearching(false);
        }
      }, 500); // Wait 500ms before API call

      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery]);

  const handleSearch = async () => {
    // Keep for manual search trigger if needed
    if (!searchQuery.trim()) {
      setSearchResults(commonFoods);
      return;
    }
  };

  const openQuantityModal = (food: FoodItem) => {
    if (!userId) {
      Alert.alert('Please sign in', 'You need to sign in to log food.');
      return;
    }
    setSelectedFood(food);
    setQuantity('1');
    setSelectedUnit(food.defaultUnit || 'g');
    setShowQuantityModal(true);
  };

  // Calculate preview nutrition based on current quantity/unit
  const getPreviewNutrition = () => {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const qty = parseFloat(quantity) || 0;
    const gramsConsumed = convertToGrams(qty, selectedUnit, selectedFood);
    return calculateNutrition(selectedFood, gramsConsumed);
  };

  const handleAddFood = async () => {
    if (!userId || !selectedFood) return;

    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    const gramsConsumed = convertToGrams(qty, selectedUnit, selectedFood);

    try {
      await addMealEntry(userId, {
        foodItem: selectedFood,
        quantity: qty,
        unit: selectedUnit,
        gramsConsumed,
        mealType: selectedMealType,
        date: today,
      });
      loadTodayMeals();
      setSearchQuery('');
      setSearchResults([]);
      setShowQuantityModal(false);
      setSelectedFood(null);
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

  const handleDeleteRecipeGroup = async (recipeGroupId: string) => {
    if (!userId) return;
    try {
      await deleteRecipeGroup(userId, recipeGroupId);
      loadTodayMeals();
    } catch (error) {
      console.error('Error deleting recipe group:', error);
    }
  };

  const handleDeleteMealType = async (mealType: MealType) => {
    if (!userId) return;
    Alert.alert(
      'Delete All',
      `Delete all ${mealType} entries for today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMealsByType(userId, today, mealType);
              loadTodayMeals();
            } catch (error) {
              console.error('Error deleting meal type:', error);
            }
          }
        }
      ]
    );
  };

  // Group meals by recipe for display
  const groupMealsByRecipe = (meals: MealEntry[]) => {
    const groups: { recipeName: string | null; recipeGroupId: string | null; meals: MealEntry[] }[] = [];
    const recipeGroups = new Map<string, MealEntry[]>();
    const standaloneMeals: MealEntry[] = [];

    meals.forEach(meal => {
      if (meal.recipeGroupId) {
        const existing = recipeGroups.get(meal.recipeGroupId) || [];
        existing.push(meal);
        recipeGroups.set(meal.recipeGroupId, existing);
      } else {
        standaloneMeals.push(meal);
      }
    });

    // Add recipe groups first
    recipeGroups.forEach((groupMeals, groupId) => {
      groups.push({
        recipeName: groupMeals[0]?.recipeName || 'Recipe',
        recipeGroupId: groupId,
        meals: groupMeals
      });
    });

    // Add standalone meals
    standaloneMeals.forEach(meal => {
      groups.push({
        recipeName: null,
        recipeGroupId: null,
        meals: [meal]
      });
    });

    return groups;
  };

  const dailyTotals = todayMeals.reduce(
    (totals, meal) => {
      let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      // Use gramsConsumed if available, otherwise fall back to old calculation
      if (meal.gramsConsumed && meal.foodItem.servingGrams) {
        nutrition = calculateNutrition(meal.foodItem, meal.gramsConsumed);
      } else {
        nutrition = {
          calories: meal.foodItem.calories * meal.quantity,
          protein: meal.foodItem.protein * meal.quantity,
          carbs: meal.foodItem.carbs * meal.quantity,
          fat: meal.foodItem.fat * meal.quantity,
        };
      }
      return {
        calories: totals.calories + Math.min(nutrition.calories, 5000),
        protein: totals.protein + nutrition.protein,
        carbs: totals.carbs + nutrition.carbs,
        fat: totals.fat + nutrition.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const totalCalories = dailyTotals.calories;
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
      source={require('@/assets/images/nbensen6_overhead_flat_lay_of_healthy_meal_prep_containers_wi_57e9c68a-5544-4aed-8ac1-2e902d6a5798_1.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <RNView style={styles.overlay}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <RNView style={[styles.container, { maxWidth: containerMaxWidth }]}>
            {/* Header */}
            <RNView style={styles.header}>
              <Text style={styles.title}>Log</Text>
            </RNView>

            {/* Total Calories Card - Tappable for History */}
            <TouchableOpacity onPress={toggleHistory} activeOpacity={0.8}>
              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.totalCard}>
                <RNView style={styles.totalHeader}>
                  <RNView style={styles.totalHeaderLeft}>
                    <Text style={styles.totalLabel}>Today's Calories</Text>
                    <Text style={styles.historyHint}>{showHistory ? '▲ Hide history' : '▼ Tap for history'}</Text>
                  </RNView>
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
                {/* Macros Row */}
                <RNView style={styles.macrosRow}>
                  <RNView style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(dailyTotals.protein)}g</Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </RNView>
                  <RNView style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(dailyTotals.carbs)}g</Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </RNView>
                  <RNView style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(dailyTotals.fat)}g</Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                  </RNView>
                </RNView>
              </LinearGradient>
            </TouchableOpacity>

            {/* Today's Meals Dropdown */}
            {showHistory && (
              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.historyDropdown}>
                <RNView style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>Today's Meals</Text>
                  {todayMeals.length > 0 && <Text style={styles.swipeHint}>← Swipe to delete</Text>}
                </RNView>
                {todayMeals.length === 0 ? (
                  <Text style={styles.emptyText}>No meals logged today</Text>
                ) : (
                  <>
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
                      const mealsOfType = todayMeals.filter(m => m.mealType === mealType);
                      if (mealsOfType.length === 0) return null;
                      return (
                        <RNView key={mealType} style={styles.historyMealGroup}>
                          <Text style={styles.historyMealType}>
                            {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                          </Text>
                          {mealsOfType.map((meal) => {
                            const mealCalories = meal.gramsConsumed && meal.foodItem.servingGrams
                              ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                              : meal.foodItem.calories * meal.quantity;
                            const displayAmount = meal.unit
                              ? `${meal.quantity} ${meal.unit}`
                              : `${meal.quantity} serving`;
                            return (
                              <SwipeableRow
                                key={meal.id}
                                onDelete={() => handleDeleteMeal(meal.id)}
                              >
                                <RNView style={styles.historyMealItemRow}>
                                  <RNView style={styles.historyMealInfo}>
                                    <Text style={styles.historyMealName}>{meal.foodItem.name}</Text>
                                    <Text style={styles.historyMealAmount}>{displayAmount}</Text>
                                  </RNView>
                                  <Text style={styles.historyMealCal}>{mealCalories} cal</Text>
                                </RNView>
                              </SwipeableRow>
                            );
                          })}
                        </RNView>
                      );
                    })}
                  </>
                )}
                <TouchableOpacity onPress={() => router.push('/weekly-log')} style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>View Past Days →</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

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

            {/* Action Buttons */}
            <RNView style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => router.push(`/barcode-scanner?mealType=${selectedMealType}`)}>
                <LinearGradient colors={['#8b5cf6', '#a78bfa']} style={styles.actionButtonGradient}>
                  <Text style={styles.actionButtonIcon}>📷</Text>
                  <Text style={styles.actionButtonText}>Scan</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/recipes')}>
                <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.actionButtonGradient}>
                  <Text style={styles.actionButtonIcon}>📋</Text>
                  <Text style={styles.actionButtonText}>Recipes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </RNView>

            {/* Search Results - only show when searching */}
            {searchQuery.trim() && searchResults.length > 0 && (
              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                {searchResults.slice(0, 8).map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    style={styles.foodItem}
                    onPress={() => openQuantityModal(food)}
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
            )}

            {/* Today's Log */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
              <RNView style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today's Log</Text>
                {todayMeals.length > 0 && <Text style={styles.swipeHint}>← Swipe to delete</Text>}
              </RNView>
              {mealTypes.map((type) => {
                const meals = getMealsByType(type);
                if (meals.length === 0) return null;
                const groupedMeals = groupMealsByRecipe(meals);

                return (
                  <RNView key={type} style={styles.mealGroup}>
                    <RNView style={styles.mealGroupHeader}>
                      <Text style={styles.mealGroupTitle}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                      <TouchableOpacity onPress={() => handleDeleteMealType(type)}>
                        <Text style={styles.clearAllText}>Clear All</Text>
                      </TouchableOpacity>
                    </RNView>
                    {groupedMeals.map((group) => {
                      const groupCalories = group.meals.reduce((sum, meal) => {
                        const cal = meal.gramsConsumed && meal.foodItem.servingGrams
                          ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                          : meal.foodItem.calories * meal.quantity;
                        return sum + cal;
                      }, 0);

                      if (group.recipeName && group.recipeGroupId) {
                        return (
                          <RNView key={group.recipeGroupId} style={styles.recipeGroup}>
                            <SwipeableRow onDelete={() => handleDeleteRecipeGroup(group.recipeGroupId!)}>
                              <RNView style={styles.recipeHeader}>
                                <Text style={styles.recipeHeaderName}>{group.recipeName}</Text>
                                <Text style={styles.recipeHeaderCal}>{groupCalories} cal</Text>
                              </RNView>
                            </SwipeableRow>
                            {group.meals.map((meal) => {
                              const mealCalories = meal.gramsConsumed && meal.foodItem.servingGrams
                                ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                                : meal.foodItem.calories * meal.quantity;
                              const displayAmount = meal.unit ? `${meal.quantity} ${meal.unit}` : `${meal.quantity} serving`;
                              return (
                                <SwipeableRow key={meal.id} onDelete={() => handleDeleteMeal(meal.id)}>
                                  <RNView style={styles.recipeIngredient}>
                                    <RNView style={styles.loggedMealInfo}>
                                      <Text style={styles.recipeIngredientName}>{meal.foodItem.name}</Text>
                                      <Text style={styles.loggedMealAmount}>{displayAmount}</Text>
                                    </RNView>
                                    <Text style={styles.recipeIngredientCal}>{mealCalories} cal</Text>
                                  </RNView>
                                </SwipeableRow>
                              );
                            })}
                          </RNView>
                        );
                      } else {
                        const meal = group.meals[0];
                        const mealCalories = meal.gramsConsumed && meal.foodItem.servingGrams
                          ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                          : meal.foodItem.calories * meal.quantity;
                        const displayAmount = meal.unit ? `${meal.quantity} ${meal.unit}` : `${meal.quantity} serving`;
                        return (
                          <SwipeableRow key={meal.id} onDelete={() => handleDeleteMeal(meal.id)}>
                            <RNView style={styles.loggedMeal}>
                              <RNView style={styles.loggedMealInfo}>
                                <Text style={styles.loggedMealName}>{meal.foodItem.name}</Text>
                                <Text style={styles.loggedMealAmount}>{displayAmount}</Text>
                              </RNView>
                              <Text style={styles.loggedMealCalories}>{mealCalories} cal</Text>
                            </RNView>
                          </SwipeableRow>
                        );
                      }
                    })}
                  </RNView>
                );
              })}
              {todayMeals.length === 0 && (
                <Text style={styles.emptyText}>No meals logged today</Text>
              )}
            </LinearGradient>
          </RNView>
        </ScrollView>

        {/* Quantity Selector Modal */}
        <Modal
          visible={showQuantityModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowQuantityModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <RNView style={styles.modalContent}>
                {/* Header with amount display */}
                <RNView style={styles.modalHeader}>
                  <RNView style={styles.modalHeaderLeft}>
                    <Text style={styles.modalTitle}>
                      {selectedFood?.name}
                    </Text>
                    <Text style={styles.modalServing}>
                      Serving: {selectedFood?.servingSize}
                    </Text>
                  </RNView>
                  <RNView style={styles.amountDisplay}>
                    <Text style={styles.amountDisplayText}>
                      {quantity || '0'} {selectedUnit}
                    </Text>
                  </RNView>
                </RNView>

                {/* Amount Input */}
                <RNView style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="Amount"
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={Keyboard.dismiss}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </RNView>

                {/* Unit Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitSelector}>
                  {(selectedFood?.availableUnits || ['g', 'oz']).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitButton,
                        selectedUnit === unit && styles.unitButtonActive,
                      ]}
                      onPress={() => {
                        setSelectedUnit(unit);
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        selectedUnit === unit && styles.unitButtonTextActive,
                      ]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Nutrition Preview */}
                <RNView style={styles.nutritionPreview}>
                  <Text style={styles.previewTitle}>Nutrition</Text>
                  <RNView style={styles.previewRow}>
                    <RNView style={styles.previewItem}>
                      <Text style={styles.previewValue}>{getPreviewNutrition().calories}</Text>
                      <Text style={styles.previewLabel}>cal</Text>
                    </RNView>
                    <RNView style={styles.previewItem}>
                      <Text style={styles.previewValue}>{getPreviewNutrition().protein}g</Text>
                      <Text style={styles.previewLabel}>protein</Text>
                    </RNView>
                    <RNView style={styles.previewItem}>
                      <Text style={styles.previewValue}>{getPreviewNutrition().carbs}g</Text>
                      <Text style={styles.previewLabel}>carbs</Text>
                    </RNView>
                    <RNView style={styles.previewItem}>
                      <Text style={styles.previewValue}>{getPreviewNutrition().fat}g</Text>
                      <Text style={styles.previewLabel}>fat</Text>
                    </RNView>
                  </RNView>
                </RNView>

                {/* Action Buttons */}
                <RNView style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowQuantityModal(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    Keyboard.dismiss();
                    handleAddFood();
                  }}>
                    <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.addButton}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </RNView>
              </RNView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
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
    alignSelf: 'center',
    width: '100%',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  macroLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  totalHeaderLeft: {
    flex: 1,
  },
  historyHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyDropdown: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  swipeHint: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  historyDay: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  historyDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historyDayCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
  },
  historyProgressBar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  historyProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  historyMealGroup: {
    marginTop: 6,
  },
  historyMealType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  historyMealItem: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
    marginBottom: 2,
  },
  historyMealItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  historyMealInfo: {
    flex: 1,
  },
  historyMealName: {
    fontSize: 13,
    color: '#fff',
  },
  historyMealAmount: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyMealCal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ade80',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
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
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  mealGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearAllText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  mealGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  loggedMeal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  loggedMealInfo: {
    flex: 1,
  },
  loggedMealName: {
    fontSize: 14,
    color: '#fff',
  },
  loggedMealAmount: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  loggedMealRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loggedMealCalories: {
    fontSize: 14,
    fontWeight: '600',
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
  // Recipe group styles
  recipeGroup: {
    marginBottom: 12,
    backgroundColor: '#252538',
    borderRadius: 12,
    overflow: 'hidden',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#3b3b5c',
  },
  recipeHeaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  recipeHeaderCal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4ade80',
  },
  recipeIngredient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    paddingLeft: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  recipeIngredientName: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  recipeIngredientCal: {
    fontSize: 13,
    color: '#94a3b8',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modalServing: {
    fontSize: 14,
    color: '#64748b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  amountDisplay: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  amountDisplayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  doneButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
    textAlign: 'center',
  },
  unitSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  unitButtonActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  unitButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  nutritionPreview: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  previewItem: {
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4ade80',
  },
  previewLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 16,
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
