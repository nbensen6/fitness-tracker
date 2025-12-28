import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { searchFoods, commonFoods } from '@/services/foodApi';
import { addMealEntry, getMealsByDate, deleteMealEntry } from '@/services/firestore';
import { FoodItem, MealEntry } from '@/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function CaloriesScreen() {
  const { userId, isSignedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [searching, setSearching] = useState(false);

  const today = new Date().toISOString().split('T')[0];

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

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const getMealsByType = (type: MealType) =>
    todayMeals.filter((meal) => meal.mealType === type);

  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to track calories</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        {/* Total Calories */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Today's Total</Text>
          <Text style={styles.totalValue}>{totalCalories} cal</Text>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search food..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Meal Type Selector */}
        <View style={styles.mealTypeSelector}>
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
        </View>

        {/* Search Results / Quick Add */}
        {(searchResults.length > 0 || searchQuery === '') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? 'Search Results' : 'Quick Add'}
            </Text>
            {(searchResults.length > 0 ? searchResults : commonFoods).slice(0, 8).map((food) => (
              <TouchableOpacity
                key={food.id}
                style={styles.foodItem}
                onPress={() => handleAddFood(food)}
              >
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodMacros}>
                    P: {food.protein}g | C: {food.carbs}g | F: {food.fat}g
                  </Text>
                </View>
                <View style={styles.foodCalories}>
                  <Text style={styles.calorieValue}>{food.calories}</Text>
                  <Text style={styles.calorieLabel}>cal</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Today's Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          {mealTypes.map((type) => {
            const meals = getMealsByType(type);
            if (meals.length === 0) return null;

            return (
              <View key={type} style={styles.mealGroup}>
                <Text style={styles.mealGroupTitle}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                {meals.map((meal) => (
                  <View key={meal.id} style={styles.loggedMeal}>
                    <View style={styles.loggedMealInfo}>
                      <Text style={styles.loggedMealName}>
                        {meal.foodItem.name}
                      </Text>
                      <Text style={styles.loggedMealCalories}>
                        {meal.foodItem.calories * meal.quantity} cal
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteMeal(meal.id)}
                    >
                      <Text style={styles.deleteButtonText}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
          {todayMeals.length === 0 && (
            <Text style={styles.emptyText}>No meals logged today</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  message: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  totalCard: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  totalValue: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  mealTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  mealTypeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 2,
  },
  mealTypeButtonActive: {
    backgroundColor: '#007AFF',
  },
  mealTypeText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
  },
  mealTypeTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  foodMacros: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  foodCalories: {
    alignItems: 'center',
  },
  calorieValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  calorieLabel: {
    fontSize: 10,
    color: '#666',
  },
  mealGroup: {
    marginBottom: 16,
  },
  mealGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  loggedMeal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  loggedMealInfo: {
    flex: 1,
  },
  loggedMealName: {
    fontSize: 14,
    color: '#333',
  },
  loggedMealCalories: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
});
