import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ImageBackground, View as RNView, Modal, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { searchFoods, commonFoods, searchCommonFoods, convertToGrams, calculateNutrition, unitToGrams } from '@/services/foodApi';
import { addMealEntry, getMealsByDate, deleteMealEntry } from '@/services/firestore';
import { FoodItem, MealEntry, ServingUnit } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function CaloriesScreen() {
  const { userId, isSignedIn, userProfile } = useAuth();
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

    // First search local common foods for instant results
    const localResults = searchCommonFoods(searchQuery);
    if (localResults.length > 0) {
      setSearchResults(localResults);
      return;
    }

    // If no local results, try the API
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

      const nutrition = calculateNutrition(selectedFood, gramsConsumed);
      Alert.alert('Success', `${selectedFood.name} (${nutrition.calories} cal) added to ${selectedMealType}`);
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
    (sum, meal) => {
      // Use gramsConsumed if available, otherwise fall back to old calculation
      if (meal.gramsConsumed && meal.foodItem.servingGrams) {
        const nutrition = calculateNutrition(meal.foodItem, meal.gramsConsumed);
        return sum + nutrition.calories;
      }
      return sum + (meal.foodItem.calories * meal.quantity);
    },
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
      source={require('@/assets/images/nbensen6_overhead_flat_lay_of_healthy_meal_prep_containers_wi_57e9c68a-5544-4aed-8ac1-2e902d6a5798_1.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <RNView style={styles.overlay}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <RNView style={styles.container}>
            {/* Header */}
            <RNView style={styles.header}>
              <Text style={styles.title}>Log</Text>
              <RNView style={styles.headerButtons}>
                <TouchableOpacity onPress={() => router.push(`/barcode-scanner?mealType=${selectedMealType}`)}>
                  <LinearGradient colors={['#8b5cf6', '#a78bfa']} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>Scan</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/recipes')}>
                  <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>Recipes</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/weekly-log')}>
                  <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>History</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </RNView>
            </RNView>

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
                    {meals.map((meal) => {
                      const mealCalories = meal.gramsConsumed && meal.foodItem.servingGrams
                        ? calculateNutrition(meal.foodItem, meal.gramsConsumed).calories
                        : meal.foodItem.calories * meal.quantity;
                      const displayAmount = meal.unit
                        ? `${meal.quantity} ${meal.unit}`
                        : `${meal.quantity} serving`;
                      return (
                        <RNView key={meal.id} style={styles.loggedMeal}>
                          <RNView style={styles.loggedMealInfo}>
                            <Text style={styles.loggedMealName}>
                              {meal.foodItem.name}
                            </Text>
                            <Text style={styles.loggedMealAmount}>
                              {displayAmount}
                            </Text>
                          </RNView>
                          <RNView style={styles.loggedMealRight}>
                            <Text style={styles.loggedMealCalories}>
                              {mealCalories} cal
                            </Text>
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
    maxWidth: '50%',
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
