import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View as RNView, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { getUserRecipes, addRecipe, deleteRecipe, addMealEntry, updateRecipe } from '@/services/firestore';
import { commonFoods, searchCommonFoods, convertToGrams, calculateNutrition, lookupBarcode } from '@/services/foodApi';
import { Recipe, RecipeIngredient, FoodItem, ServingUnit } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function RecipesScreen() {
  const { userId, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);

  // New recipe state
  const [recipeName, setRecipeName] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeMealType, setRecipeMealType] = useState<MealType>('breakfast');

  // Edit recipe state
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Add ingredient state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>(commonFoods.slice(0, 10));
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState<ServingUnit>('g');

  // Barcode scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningBarcode, setScanningBarcode] = useState(false);

  useEffect(() => {
    if (userId) {
      loadRecipes();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadRecipes = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const userRecipes = await getUserRecipes(userId);
      setRecipes(userRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(commonFoods.slice(0, 10));
      return;
    }
    const results = searchCommonFoods(query);
    setSearchResults(results.length > 0 ? results : commonFoods.slice(0, 10));
  };

  const selectFoodForIngredient = (food: FoodItem) => {
    setSelectedFood(food);
    setQuantity('1');
    setSelectedUnit(food.defaultUnit || 'g');
  };

  const addIngredientToRecipe = () => {
    if (!selectedFood) return;

    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    const gramsConsumed = convertToGrams(qty, selectedUnit, selectedFood);
    const ingredient: RecipeIngredient = {
      foodItem: selectedFood,
      quantity: qty,
      unit: selectedUnit,
      gramsConsumed,
    };

    setRecipeIngredients([...recipeIngredients, ingredient]);
    // Stay in search mode for adding more ingredients
    setSelectedFood(null);
    setSearchQuery('');
    setSearchResults(commonFoods.slice(0, 10));
    // Don't close modal - user can add more or tap X to close
  };

  const removeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const calculateRecipeTotals = () => {
    return recipeIngredients.reduce(
      (totals, ing) => {
        const nutrition = calculateNutrition(ing.foodItem, ing.gramsConsumed);
        return {
          calories: totals.calories + nutrition.calories,
          protein: totals.protein + nutrition.protein,
          carbs: totals.carbs + nutrition.carbs,
          fat: totals.fat + nutrition.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const saveRecipe = async () => {
    if (!userId) return;
    if (!recipeName.trim()) {
      Alert.alert('Missing name', 'Please enter a recipe name.');
      return;
    }
    if (recipeIngredients.length === 0) {
      Alert.alert('No ingredients', 'Please add at least one ingredient.');
      return;
    }

    const totals = calculateRecipeTotals();

    try {
      if (editingRecipe) {
        // Update existing recipe
        await updateRecipe(editingRecipe.id, {
          name: recipeName.trim(),
          ingredients: recipeIngredients,
          totalCalories: totals.calories,
          totalProtein: totals.protein,
          totalCarbs: totals.carbs,
          totalFat: totals.fat,
          defaultMealType: recipeMealType,
        });
        Alert.alert('Success', 'Recipe updated!');
      } else {
        // Create new recipe
        await addRecipe(userId, {
          name: recipeName.trim(),
          ingredients: recipeIngredients,
          totalCalories: totals.calories,
          totalProtein: totals.protein,
          totalCarbs: totals.carbs,
          totalFat: totals.fat,
          defaultMealType: recipeMealType,
        });
        Alert.alert('Success', 'Recipe saved!');
      }

      // Reset form
      setRecipeName('');
      setRecipeIngredients([]);
      setRecipeMealType('breakfast');
      setEditingRecipe(null);
      setShowCreateModal(false);
      loadRecipes();
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'Failed to save recipe');
    }
  };

  const startEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setRecipeName(recipe.name);
    setRecipeIngredients([...recipe.ingredients]);
    setRecipeMealType(recipe.defaultMealType);
    setShowCreateModal(true);
  };

  // Barcode scanning
  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanningBarcode) return;
    setScanningBarcode(true);

    try {
      const food = await lookupBarcode(data);
      if (food) {
        setShowScanner(false);
        setSelectedFood(food);
        setQuantity('1');
        setSelectedUnit(food.defaultUnit || 'g');
      } else {
        Alert.alert('Not Found', 'Could not find nutritional info for this barcode.');
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      Alert.alert('Error', 'Failed to look up barcode');
    } finally {
      setScanningBarcode(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan barcodes.');
        return;
      }
    }
    setShowScanner(true);
  };

  const useRecipe = async (recipe: Recipe) => {
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Add each ingredient as a separate meal entry
      for (const ingredient of recipe.ingredients) {
        await addMealEntry(userId, {
          foodItem: ingredient.foodItem,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          gramsConsumed: ingredient.gramsConsumed,
          mealType: recipe.defaultMealType,
          date: today,
        });
      }

      Alert.alert('Added!', `${recipe.name} added to your ${recipe.defaultMealType} log.`);
    } catch (error) {
      console.error('Error using recipe:', error);
      Alert.alert('Error', 'Failed to add recipe to log');
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(recipeId);
              setRecipes(recipes.filter(r => r.id !== recipeId));
            } catch (error) {
              console.error('Error deleting recipe:', error);
            }
          },
        },
      ]
    );
  };

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={[styles.messageContainer, { paddingTop: insets.top }]}>
          <Text style={styles.message}>Please sign in to use recipes</Text>
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
          <Text style={styles.title}>Recipes</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ New</Text>
            </LinearGradient>
          </TouchableOpacity>
        </RNView>

        {loading ? (
          <RNView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e94560" />
          </RNView>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {recipes.length === 0 ? (
              <RNView style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No recipes yet</Text>
                <Text style={styles.emptySubtext}>Create a recipe to quickly log your favorite meals</Text>
              </RNView>
            ) : (
              recipes.map((recipe) => (
                <LinearGradient key={recipe.id} colors={['#2d2d44', '#1f1f2e']} style={styles.recipeCard}>
                  <RNView style={styles.recipeHeader}>
                    <RNView>
                      <Text style={styles.recipeName}>{recipe.name}</Text>
                      <Text style={styles.recipeMealType}>
                        {recipe.defaultMealType.charAt(0).toUpperCase() + recipe.defaultMealType.slice(1)}
                      </Text>
                    </RNView>
                    <RNView style={styles.recipeCalories}>
                      <Text style={styles.calorieValue}>{recipe.totalCalories}</Text>
                      <Text style={styles.calorieLabel}>cal</Text>
                    </RNView>
                  </RNView>

                  <RNView style={styles.macrosRow}>
                    <Text style={styles.macroText}>P: {recipe.totalProtein}g</Text>
                    <Text style={styles.macroText}>C: {recipe.totalCarbs}g</Text>
                    <Text style={styles.macroText}>F: {recipe.totalFat}g</Text>
                  </RNView>

                  <Text style={styles.ingredientCount}>
                    {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                  </Text>

                  <RNView style={styles.recipeActions}>
                    <TouchableOpacity onPress={() => useRecipe(recipe)} style={styles.useButton}>
                      <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.useButtonGradient}>
                        <Text style={styles.useButtonText}>Add to Log</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => startEditRecipe(recipe)} style={styles.editRecipeButton}>
                      <Text style={styles.editRecipeText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteRecipe(recipe.id)} style={styles.deleteRecipeButton}>
                      <Text style={styles.deleteRecipeText}>Delete</Text>
                    </TouchableOpacity>
                  </RNView>
                </LinearGradient>
              ))
            )}
            <RNView style={styles.bottomSpacer} />
          </ScrollView>
        )}

        {/* Create/Edit Recipe Modal */}
        <Modal visible={showCreateModal} animationType="slide" transparent={true}>
          <RNView style={styles.modalOverlay}>
            <RNView style={[styles.modalContent, { paddingTop: insets.top + 20 }]}>
              <RNView style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</Text>
                <TouchableOpacity onPress={() => {
                  setShowCreateModal(false);
                  setRecipeName('');
                  setRecipeIngredients([]);
                  setEditingRecipe(null);
                }}>
                  <Text style={styles.closeButton}>X</Text>
                </TouchableOpacity>
              </RNView>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Recipe Name */}
                <Text style={styles.inputLabel}>Recipe Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={recipeName}
                  onChangeText={setRecipeName}
                  placeholder="e.g., Morning Protein Shake"
                  placeholderTextColor="#64748b"
                />

                {/* Meal Type */}
                <Text style={styles.inputLabel}>Default Meal Type</Text>
                <RNView style={styles.mealTypeSelector}>
                  {mealTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.mealTypeButton, recipeMealType === type && styles.mealTypeActive]}
                      onPress={() => setRecipeMealType(type)}
                    >
                      <Text style={[styles.mealTypeText, recipeMealType === type && styles.mealTypeTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </RNView>

                {/* Ingredients */}
                <RNView style={styles.ingredientsHeader}>
                  <Text style={styles.inputLabel}>Ingredients</Text>
                  <TouchableOpacity onPress={() => setShowAddIngredientModal(true)}>
                    <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.addIngredientButton}>
                      <Text style={styles.addIngredientText}>+ Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </RNView>

                {recipeIngredients.length === 0 ? (
                  <Text style={styles.noIngredientsText}>No ingredients added yet</Text>
                ) : (
                  recipeIngredients.map((ing, index) => {
                    const nutrition = calculateNutrition(ing.foodItem, ing.gramsConsumed);
                    return (
                      <RNView key={index} style={styles.ingredientItem}>
                        <RNView style={styles.ingredientInfo}>
                          <Text style={styles.ingredientName}>{ing.foodItem.name}</Text>
                          <Text style={styles.ingredientAmount}>
                            {ing.quantity} {ing.unit} - {nutrition.calories} cal
                          </Text>
                        </RNView>
                        <TouchableOpacity onPress={() => removeIngredient(index)}>
                          <Text style={styles.removeIngredient}>X</Text>
                        </TouchableOpacity>
                      </RNView>
                    );
                  })
                )}

                {/* Totals */}
                {recipeIngredients.length > 0 && (
                  <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.totalsCard}>
                    <Text style={styles.totalsTitle}>Recipe Totals</Text>
                    <RNView style={styles.totalsRow}>
                      <RNView style={styles.totalItem}>
                        <Text style={styles.totalValue}>{calculateRecipeTotals().calories}</Text>
                        <Text style={styles.totalLabel}>cal</Text>
                      </RNView>
                      <RNView style={styles.totalItem}>
                        <Text style={styles.totalValue}>{calculateRecipeTotals().protein}g</Text>
                        <Text style={styles.totalLabel}>protein</Text>
                      </RNView>
                      <RNView style={styles.totalItem}>
                        <Text style={styles.totalValue}>{calculateRecipeTotals().carbs}g</Text>
                        <Text style={styles.totalLabel}>carbs</Text>
                      </RNView>
                      <RNView style={styles.totalItem}>
                        <Text style={styles.totalValue}>{calculateRecipeTotals().fat}g</Text>
                        <Text style={styles.totalLabel}>fat</Text>
                      </RNView>
                    </RNView>
                  </LinearGradient>
                )}

                {/* Save Button */}
                <TouchableOpacity onPress={saveRecipe} style={styles.saveButton}>
                  <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.saveButtonGradient}>
                    <Text style={styles.saveButtonText}>Save Recipe</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </RNView>
          </RNView>
        </Modal>

        {/* Add Ingredient Modal */}
        <Modal visible={showAddIngredientModal} animationType="slide" transparent={true}>
          <RNView style={styles.modalOverlay}>
            <RNView style={[styles.modalContent, { paddingTop: insets.top + 20 }]}>
              <RNView style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Ingredient</Text>
                <TouchableOpacity onPress={() => {
                  setShowAddIngredientModal(false);
                  setSelectedFood(null);
                  setSearchQuery('');
                  setShowScanner(false);
                }}>
                  <Text style={styles.closeButton}>X</Text>
                </TouchableOpacity>
              </RNView>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {showScanner ? (
                  <RNView style={styles.scannerContainer}>
                    <CameraView
                      style={styles.scanner}
                      barcodeScannerSettings={{
                        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                      }}
                      onBarcodeScanned={handleBarcodeScan}
                    />
                    {scanningBarcode && (
                      <RNView style={styles.scanningOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.scanningText}>Looking up product...</Text>
                      </RNView>
                    )}
                    <TouchableOpacity style={styles.closeScannerButton} onPress={() => setShowScanner(false)}>
                      <Text style={styles.closeScannerText}>Cancel Scan</Text>
                    </TouchableOpacity>
                  </RNView>
                ) : !selectedFood ? (
                  <>
                    {/* Search */}
                    <RNView style={styles.searchRow}>
                      <TextInput
                        style={styles.searchInputFull}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholder="Search food..."
                        placeholderTextColor="#64748b"
                        autoCorrect={false}
                      />
                    </RNView>

                    {/* Scan Button */}
                    <TouchableOpacity onPress={openScanner} style={styles.scanButton}>
                      <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.scanButtonGradient}>
                        <Text style={styles.scanButtonText}>Scan Barcode</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Food List */}
                    {searchResults.map((food) => (
                      <TouchableOpacity
                        key={food.id}
                        style={styles.foodItem}
                        onPress={() => selectFoodForIngredient(food)}
                      >
                        <RNView style={styles.foodInfo}>
                          <Text style={styles.foodName}>{food.name}</Text>
                          <Text style={styles.foodMacros}>
                            P: {food.protein}g | C: {food.carbs}g | F: {food.fat}g
                          </Text>
                        </RNView>
                        <RNView style={styles.foodCalories}>
                          <Text style={styles.foodCalorieValue}>{food.calories}</Text>
                          <Text style={styles.foodCalorieLabel}>cal</Text>
                        </RNView>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <>
                    {/* Selected Food */}
                    <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
                    <Text style={styles.selectedFoodServing}>Serving: {selectedFood.servingSize}</Text>

                    {/* Quantity Input */}
                    <Text style={styles.inputLabel}>Amount</Text>
                    <TextInput
                      style={styles.textInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="Amount"
                      placeholderTextColor="#64748b"
                    />

                    {/* Unit Selector */}
                    <Text style={styles.inputLabel}>Unit</Text>
                    <RNView style={styles.unitSelector}>
                      {(selectedFood.availableUnits || ['g', 'oz']).map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.unitButton, selectedUnit === unit && styles.unitButtonActive]}
                          onPress={() => setSelectedUnit(unit)}
                        >
                          <Text style={[styles.unitButtonText, selectedUnit === unit && styles.unitButtonTextActive]}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </RNView>

                    {/* Preview */}
                    {(() => {
                      const qty = parseFloat(quantity) || 0;
                      const grams = convertToGrams(qty, selectedUnit, selectedFood);
                      const preview = calculateNutrition(selectedFood, grams);
                      return (
                        <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.previewCard}>
                          <Text style={styles.previewTitle}>Nutrition Preview</Text>
                          <RNView style={styles.previewRow}>
                            <Text style={styles.previewValue}>{preview.calories} cal</Text>
                            <Text style={styles.previewMacro}>P: {preview.protein}g</Text>
                            <Text style={styles.previewMacro}>C: {preview.carbs}g</Text>
                            <Text style={styles.previewMacro}>F: {preview.fat}g</Text>
                          </RNView>
                        </LinearGradient>
                      );
                    })()}

                    {/* Add/Cancel Buttons */}
                    <RNView style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setSelectedFood(null)}
                      >
                        <Text style={styles.cancelButtonText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={addIngredientToRecipe}>
                        <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.confirmButton}>
                          <Text style={styles.confirmButtonText}>Add Ingredient</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </RNView>
                  </>
                )}
              </ScrollView>
            </RNView>
          </RNView>
        </Modal>
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
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  recipeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  recipeMealType: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  recipeCalories: {
    alignItems: 'center',
  },
  calorieValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4ade80',
  },
  calorieLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  macroText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  ingredientCount: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  useButton: {
    flex: 1,
  },
  useButtonGradient: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  useButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  editRecipeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  editRecipeText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  deleteRecipeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  deleteRecipeText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '600',
    padding: 8,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  mealTypeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
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
  mealTypeActive: {
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
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addIngredientButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addIngredientText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  noIngredientsText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  ingredientAmount: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  removeIngredient: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
  },
  totalsCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  totalsTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    textAlign: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  saveButton: {
    marginBottom: 40,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Add Ingredient Modal
  searchRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchInputFull: {
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
    padding: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 15,
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
  foodCalorieValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  foodCalorieLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  selectedFoodName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  selectedFoodServing: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
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
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
  },
  previewMacro: {
    fontSize: 14,
    color: '#94a3b8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Scanner styles
  scanButton: {
    marginBottom: 16,
  },
  scanButtonGradient: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scannerContainer: {
    height: 350,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  closeScannerButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeScannerText: {
    color: '#fff',
    fontWeight: '600',
  },
});
