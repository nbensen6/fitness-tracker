import { FoodItem, ServingUnit } from '../types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/cgi/search.pl';
const OPEN_FOOD_FACTS_PRODUCT_API = 'https://world.openfoodfacts.org/api/v0/product';

interface OpenFoodFactsProduct {
  code: string;
  product_name: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
  serving_size?: string;
}

// Unit conversion to grams
export const unitToGrams: Record<ServingUnit, number> = {
  g: 1,
  oz: 28.35,
  cup: 240, // varies by food, this is approximate for liquids
  tbsp: 15,
  tsp: 5,
  piece: 1, // varies by food
  slice: 1, // varies by food
  ml: 1, // approximate, varies by density
};

// Convert amount from one unit to grams
export const convertToGrams = (amount: number, unit: ServingUnit, food?: FoodItem): number => {
  if (unit === 'piece' || unit === 'slice') {
    // For pieces/slices, use the food's serving grams
    return amount * (food?.servingGrams || 100);
  }
  if (unit === 'cup' && food?.gramsPerCup) {
    // Use food-specific cup conversion if available
    return amount * food.gramsPerCup;
  }
  return amount * unitToGrams[unit];
};

// Calculate nutrition based on grams consumed
export const calculateNutrition = (food: FoodItem, gramsConsumed: number) => {
  const ratio = gramsConsumed / food.servingGrams;
  return {
    calories: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
  };
};

export const searchFoods = async (searchTerm: string): Promise<FoodItem[]> => {
  try {
    const response = await fetch(
      `${OPEN_FOOD_FACTS_API}?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=20`
    );

    const data = await response.json();

    if (!data.products) return [];

    return data.products
      .filter((p: OpenFoodFactsProduct) => p.product_name && p.nutriments)
      .map((product: OpenFoodFactsProduct): FoodItem => ({
        id: product.code,
        name: product.product_name,
        calories: Math.round(product.nutriments['energy-kcal_100g'] || 0),
        protein: Math.round(product.nutriments.proteins_100g || 0),
        carbs: Math.round(product.nutriments.carbohydrates_100g || 0),
        fat: Math.round(product.nutriments.fat_100g || 0),
        servingSize: '100g',
        servingGrams: 100, // API returns per 100g
        defaultUnit: 'g',
        availableUnits: ['g', 'oz'],
      }));
  } catch (error) {
    console.error('Error searching foods:', error);
    return [];
  }
};

// Lookup food by barcode using Open Food Facts API
export const lookupBarcode = async (barcode: string): Promise<FoodItem | null> => {
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_PRODUCT_API}/${barcode}.json`);
    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    // Get serving size info
    const servingSize = product.serving_size || '100g';
    const servingGrams = product.serving_quantity
      ? parseFloat(product.serving_quantity)
      : 100;

    return {
      id: barcode,
      name: product.product_name || product.product_name_en || 'Unknown Product',
      calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
      protein: Math.round(nutriments.proteins_100g || nutriments.proteins || 0),
      carbs: Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
      fat: Math.round(nutriments.fat_100g || nutriments.fat || 0),
      servingSize: servingSize,
      servingGrams: servingGrams > 0 ? servingGrams : 100,
      defaultUnit: 'g',
      availableUnits: ['g', 'oz'],
    };
  } catch (error) {
    console.error('Error looking up barcode:', error);
    return null;
  }
};

// Common foods for quick add - comprehensive list with gram data
export const commonFoods: FoodItem[] = [
  // Breakfast
  { id: 'oats', name: 'Oats (dry)', calories: 150, protein: 5, carbs: 27, fat: 3, servingSize: '40g (1/2 cup)', servingGrams: 40, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 80 },
  { id: 'oatmeal-cooked', name: 'Oatmeal (cooked)', calories: 160, protein: 6, carbs: 28, fat: 3, servingSize: '1 cup (240g)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 240 },
  { id: 'egg', name: 'Egg (large)', calories: 72, protein: 6, carbs: 0, fat: 5, servingSize: '1 egg (50g)', servingGrams: 50, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'egg-whites', name: 'Egg Whites', calories: 17, protein: 4, carbs: 0, fat: 0, servingSize: '1 egg white (33g)', servingGrams: 33, defaultUnit: 'piece', availableUnits: ['piece', 'g', 'ml'] },
  { id: 'greek-yogurt', name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 1, servingSize: '170g', servingGrams: 170, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 245 },
  { id: 'milk', name: 'Milk (2%)', calories: 122, protein: 8, carbs: 12, fat: 5, servingSize: '1 cup (244ml)', servingGrams: 244, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 244 },
  { id: 'almond-milk', name: 'Almond Milk (unsweetened)', calories: 30, protein: 1, carbs: 1, fat: 3, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },

  // Proteins
  { id: 'chicken-breast', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'chicken-thigh', name: 'Chicken Thigh', calories: 209, protein: 26, carbs: 0, fat: 11, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'ground-beef', name: 'Ground Beef (93% lean)', calories: 170, protein: 23, carbs: 0, fat: 8, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'ground-beef-80', name: 'Ground Beef (80% lean)', calories: 254, protein: 17, carbs: 0, fat: 20, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'steak', name: 'Steak (sirloin)', calories: 200, protein: 27, carbs: 0, fat: 10, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'salmon', name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'tuna', name: 'Tuna (canned)', calories: 116, protein: 26, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'shrimp', name: 'Shrimp', calories: 99, protein: 24, carbs: 0, fat: 0, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'turkey', name: 'Turkey Breast', calories: 135, protein: 30, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'ground-turkey', name: 'Ground Turkey (93% lean)', calories: 150, protein: 21, carbs: 0, fat: 7, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'bacon', name: 'Bacon', calories: 541, protein: 37, carbs: 1, fat: 42, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'slice', 'oz'] },
  { id: 'bacon-slice', name: 'Bacon (1 slice)', calories: 43, protein: 3, carbs: 0, fat: 3, servingSize: '1 slice (8g)', servingGrams: 8, defaultUnit: 'slice', availableUnits: ['slice', 'g'] },
  { id: 'pork-chop', name: 'Pork Chop', calories: 231, protein: 25, carbs: 0, fat: 14, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },

  // Protein Powders & Supplements
  { id: 'whey-protein', name: 'Whey Protein Powder', calories: 120, protein: 24, carbs: 3, fat: 1, servingSize: '1 scoop (30g)', servingGrams: 30, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'casein-protein', name: 'Casein Protein Powder', calories: 120, protein: 24, carbs: 3, fat: 1, servingSize: '1 scoop (33g)', servingGrams: 33, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'plant-protein', name: 'Plant Protein Powder', calories: 110, protein: 21, carbs: 4, fat: 2, servingSize: '1 scoop (30g)', servingGrams: 30, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mass-gainer', name: 'Mass Gainer', calories: 650, protein: 50, carbs: 85, fat: 10, servingSize: '2 scoops (165g)', servingGrams: 165, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'creatine', name: 'Creatine Monohydrate', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '1 scoop (5g)', servingGrams: 5, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'pre-workout', name: 'Pre-Workout', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '1 scoop (10g)', servingGrams: 10, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Carbs
  { id: 'rice-white', name: 'White Rice (cooked)', calories: 130, protein: 3, carbs: 28, fat: 0, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 185 },
  { id: 'rice-brown', name: 'Brown Rice (cooked)', calories: 112, protein: 3, carbs: 24, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 195 },
  { id: 'jasmine-rice', name: 'Jasmine Rice (cooked)', calories: 130, protein: 3, carbs: 28, fat: 0, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 185 },
  { id: 'quinoa', name: 'Quinoa (cooked)', calories: 120, protein: 4, carbs: 21, fat: 2, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 185 },
  { id: 'pasta', name: 'Pasta (cooked)', calories: 131, protein: 5, carbs: 25, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'cup', 'oz'], gramsPerCup: 140 },
  { id: 'bread', name: 'Bread (whole wheat)', calories: 81, protein: 4, carbs: 14, fat: 1, servingSize: '1 slice (43g)', servingGrams: 43, defaultUnit: 'slice', availableUnits: ['slice', 'g'] },
  { id: 'bread-white', name: 'Bread (white)', calories: 75, protein: 2, carbs: 14, fat: 1, servingSize: '1 slice (30g)', servingGrams: 30, defaultUnit: 'slice', availableUnits: ['slice', 'g'] },
  { id: 'bagel', name: 'Bagel', calories: 245, protein: 10, carbs: 48, fat: 1, servingSize: '1 bagel (98g)', servingGrams: 98, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'tortilla', name: 'Flour Tortilla', calories: 144, protein: 4, carbs: 24, fat: 4, servingSize: '1 tortilla (49g)', servingGrams: 49, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'sweet-potato', name: 'Sweet Potato', calories: 103, protein: 2, carbs: 24, fat: 0, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'potato', name: 'Potato', calories: 93, protein: 2, carbs: 21, fat: 0, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'cereal', name: 'Cereal (generic)', calories: 110, protein: 2, carbs: 24, fat: 1, servingSize: '1 cup (30g)', servingGrams: 30, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 30 },
  { id: 'granola', name: 'Granola', calories: 200, protein: 5, carbs: 30, fat: 8, servingSize: '1/2 cup (50g)', servingGrams: 50, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 100 },

  // Fruits
  { id: 'banana', name: 'Banana (medium)', calories: 105, protein: 1, carbs: 27, fat: 0, servingSize: '1 banana (118g)', servingGrams: 118, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'apple', name: 'Apple (medium)', calories: 95, protein: 0, carbs: 25, fat: 0, servingSize: '1 apple (182g)', servingGrams: 182, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'orange', name: 'Orange', calories: 62, protein: 1, carbs: 15, fat: 0, servingSize: '1 orange (131g)', servingGrams: 131, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'berries', name: 'Mixed Berries', calories: 70, protein: 1, carbs: 17, fat: 0, servingSize: '1 cup (150g)', servingGrams: 150, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 150 },
  { id: 'strawberries', name: 'Strawberries', calories: 49, protein: 1, carbs: 12, fat: 0, servingSize: '1 cup (152g)', servingGrams: 152, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 152 },
  { id: 'blueberries', name: 'Blueberries', calories: 84, protein: 1, carbs: 21, fat: 0, servingSize: '1 cup (148g)', servingGrams: 148, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 148 },
  { id: 'grapes', name: 'Grapes', calories: 104, protein: 1, carbs: 27, fat: 0, servingSize: '1 cup (151g)', servingGrams: 151, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 151 },
  { id: 'mango', name: 'Mango', calories: 99, protein: 1, carbs: 25, fat: 1, servingSize: '1 cup (165g)', servingGrams: 165, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'piece'], gramsPerCup: 165 },
  { id: 'pineapple', name: 'Pineapple', calories: 82, protein: 1, carbs: 22, fat: 0, servingSize: '1 cup (165g)', servingGrams: 165, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 165 },
  { id: 'watermelon', name: 'Watermelon', calories: 46, protein: 1, carbs: 12, fat: 0, servingSize: '1 cup (152g)', servingGrams: 152, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 152 },

  // Vegetables
  { id: 'broccoli', name: 'Broccoli', calories: 55, protein: 4, carbs: 11, fat: 1, servingSize: '1 cup (156g)', servingGrams: 156, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 156 },
  { id: 'spinach', name: 'Spinach', calories: 7, protein: 1, carbs: 1, fat: 0, servingSize: '1 cup (30g)', servingGrams: 30, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 30 },
  { id: 'kale', name: 'Kale', calories: 33, protein: 3, carbs: 6, fat: 0, servingSize: '1 cup (67g)', servingGrams: 67, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 67 },
  { id: 'asparagus', name: 'Asparagus', calories: 27, protein: 3, carbs: 5, fat: 0, servingSize: '1 cup (134g)', servingGrams: 134, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 134 },
  { id: 'green-beans', name: 'Green Beans', calories: 31, protein: 2, carbs: 7, fat: 0, servingSize: '1 cup (100g)', servingGrams: 100, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 100 },
  { id: 'carrots', name: 'Carrots', calories: 52, protein: 1, carbs: 12, fat: 0, servingSize: '1 cup (128g)', servingGrams: 128, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'piece'], gramsPerCup: 128 },
  { id: 'bell-pepper', name: 'Bell Pepper', calories: 31, protein: 1, carbs: 6, fat: 0, servingSize: '1 pepper (119g)', servingGrams: 119, defaultUnit: 'piece', availableUnits: ['piece', 'cup', 'g'] },
  { id: 'onion', name: 'Onion', calories: 44, protein: 1, carbs: 10, fat: 0, servingSize: '1 medium (110g)', servingGrams: 110, defaultUnit: 'piece', availableUnits: ['piece', 'cup', 'g'] },
  { id: 'tomato', name: 'Tomato', calories: 22, protein: 1, carbs: 5, fat: 0, servingSize: '1 medium (123g)', servingGrams: 123, defaultUnit: 'piece', availableUnits: ['piece', 'cup', 'g'] },
  { id: 'cucumber', name: 'Cucumber', calories: 16, protein: 1, carbs: 4, fat: 0, servingSize: '1 cup (104g)', servingGrams: 104, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'piece'], gramsPerCup: 104 },
  { id: 'lettuce', name: 'Lettuce (iceberg)', calories: 10, protein: 1, carbs: 2, fat: 0, servingSize: '1 cup (72g)', servingGrams: 72, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 72 },
  { id: 'mushrooms', name: 'Mushrooms', calories: 15, protein: 2, carbs: 2, fat: 0, servingSize: '1 cup (70g)', servingGrams: 70, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 70 },
  { id: 'corn', name: 'Corn', calories: 132, protein: 5, carbs: 29, fat: 2, servingSize: '1 cup (154g)', servingGrams: 154, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 154 },
  { id: 'avocado', name: 'Avocado', calories: 234, protein: 3, carbs: 12, fat: 21, servingSize: '1 avocado (150g)', servingGrams: 150, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Dairy & Cheese
  { id: 'cottage-cheese', name: 'Cottage Cheese', calories: 163, protein: 28, carbs: 6, fat: 2, servingSize: '1 cup (226g)', servingGrams: 226, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 226 },
  { id: 'cheddar-cheese', name: 'Cheddar Cheese', calories: 113, protein: 7, carbs: 0, fat: 9, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'mozzarella', name: 'Mozzarella Cheese', calories: 85, protein: 6, carbs: 1, fat: 6, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'cream-cheese', name: 'Cream Cheese', calories: 99, protein: 2, carbs: 2, fat: 10, servingSize: '2 tbsp (29g)', servingGrams: 29, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'butter', name: 'Butter', calories: 102, protein: 0, carbs: 0, fat: 12, servingSize: '1 tbsp (14g)', servingGrams: 14, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },

  // Fats & Nuts
  { id: 'peanut-butter', name: 'Peanut Butter', calories: 188, protein: 8, carbs: 6, fat: 16, servingSize: '2 tbsp (32g)', servingGrams: 32, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g', 'oz'] },
  { id: 'almond-butter', name: 'Almond Butter', calories: 196, protein: 7, carbs: 6, fat: 18, servingSize: '2 tbsp (32g)', servingGrams: 32, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'almonds', name: 'Almonds', calories: 164, protein: 6, carbs: 6, fat: 14, servingSize: '28g (1 oz)', servingGrams: 28, defaultUnit: 'g', availableUnits: ['g', 'oz', 'cup'], gramsPerCup: 140 },
  { id: 'walnuts', name: 'Walnuts', calories: 185, protein: 4, carbs: 4, fat: 18, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'cup'], gramsPerCup: 120 },
  { id: 'cashews', name: 'Cashews', calories: 157, protein: 5, carbs: 9, fat: 12, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'cup'], gramsPerCup: 130 },
  { id: 'peanuts', name: 'Peanuts', calories: 161, protein: 7, carbs: 5, fat: 14, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'cup'], gramsPerCup: 146 },
  { id: 'olive-oil', name: 'Olive Oil', calories: 119, protein: 0, carbs: 0, fat: 14, servingSize: '1 tbsp (14g)', servingGrams: 14, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'tsp', 'ml'] },
  { id: 'coconut-oil', name: 'Coconut Oil', calories: 121, protein: 0, carbs: 0, fat: 13, servingSize: '1 tbsp (14g)', servingGrams: 14, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'tsp', 'ml'] },

  // Snacks & Other
  { id: 'honey', name: 'Honey', calories: 64, protein: 0, carbs: 17, fat: 0, servingSize: '1 tbsp (21g)', servingGrams: 21, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'tsp', 'g'] },
  { id: 'sugar', name: 'Sugar', calories: 49, protein: 0, carbs: 13, fat: 0, servingSize: '1 tbsp (13g)', servingGrams: 13, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'tsp', 'g'] },
  { id: 'rice-cake', name: 'Rice Cake', calories: 35, protein: 1, carbs: 7, fat: 0, servingSize: '1 cake (9g)', servingGrams: 9, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'hummus', name: 'Hummus', calories: 70, protein: 2, carbs: 6, fat: 5, servingSize: '2 tbsp (30g)', servingGrams: 30, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g', 'cup'], gramsPerCup: 240 },
  { id: 'dark-chocolate', name: 'Dark Chocolate (70%)', calories: 170, protein: 2, carbs: 13, fat: 12, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'popcorn', name: 'Popcorn (air-popped)', calories: 31, protein: 1, carbs: 6, fat: 0, servingSize: '1 cup (8g)', servingGrams: 8, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 8 },
  { id: 'chips', name: 'Potato Chips', calories: 152, protein: 2, carbs: 15, fat: 10, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'pizza-slice', name: 'Pizza (cheese, 1 slice)', calories: 285, protein: 12, carbs: 36, fat: 10, servingSize: '1 slice (107g)', servingGrams: 107, defaultUnit: 'slice', availableUnits: ['slice', 'g'] },

  // Beverages
  { id: 'orange-juice', name: 'Orange Juice', calories: 112, protein: 2, carbs: 26, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'coffee-black', name: 'Coffee (black)', calories: 2, protein: 0, carbs: 0, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'soda', name: 'Soda (cola)', calories: 140, protein: 0, carbs: 39, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'cup', 'oz'] },
  { id: 'beer', name: 'Beer (regular)', calories: 153, protein: 2, carbs: 13, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'wine-red', name: 'Red Wine', calories: 125, protein: 0, carbs: 4, fat: 0, servingSize: '5 oz (148ml)', servingGrams: 148, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
];

// Search common foods locally first, then try API
export const searchCommonFoods = (query: string): FoodItem[] => {
  const lowerQuery = query.toLowerCase();
  return commonFoods.filter(food =>
    food.name.toLowerCase().includes(lowerQuery)
  );
};
