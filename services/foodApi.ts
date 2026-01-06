import { FoodItem, ServingUnit } from '../types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/cgi/search.pl';
const OPEN_FOOD_FACTS_PRODUCT_API = 'https://world.openfoodfacts.org/api/v0/product';

interface OpenFoodFactsNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal_serving'?: number;
  'energy-kcal'?: number;
  // Some products store energy in kilojoules (kJ) instead of kcal
  'energy-kj_100g'?: number;
  'energy-kj_serving'?: number;
  'energy_100g'?: number; // Often in kJ
  'energy_serving'?: number;
  proteins_100g?: number;
  proteins_serving?: number;
  proteins?: number;
  carbohydrates_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates?: number;
  fat_100g?: number;
  fat_serving?: number;
  fat?: number;
}

interface OpenFoodFactsProduct {
  code: string;
  product_name: string;
  nutriments: OpenFoodFactsNutriments;
  serving_size?: string;
  serving_quantity?: number;
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
    // For piece-based scanned foods (defaultUnit === 'piece'), gramsPerCup stores grams per piece
    // For manually defined foods, use servingGrams
    if (food?.defaultUnit === 'piece' && food?.gramsPerCup) {
      return amount * food.gramsPerCup;
    }
    return amount * (food?.servingGrams || 100);
  }
  if (unit === 'cup' && food?.gramsPerCup && food?.defaultUnit !== 'piece') {
    // Use food-specific cup conversion if available (but not for piece-based foods)
    return amount * food.gramsPerCup;
  }
  return amount * unitToGrams[unit];
};

// Calculate nutrition based on grams consumed
export const calculateNutrition = (food: FoodItem, gramsConsumed: number) => {
  // Safeguard against division by zero or invalid servingGrams
  const servingGrams = food.servingGrams && food.servingGrams > 0 ? food.servingGrams : 100;
  const ratio = gramsConsumed / servingGrams;

  // Sanity check: ratio shouldn't be more than 100x (eating 10kg of something)
  const safeRatio = Math.min(ratio, 100);

  return {
    calories: Math.round(food.calories * safeRatio),
    protein: Math.round(food.protein * safeRatio * 10) / 10,
    carbs: Math.round(food.carbs * safeRatio * 10) / 10,
    fat: Math.round(food.fat * safeRatio * 10) / 10,
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

// Helper to get per-100g value from nutriments
// Priority: _100g field > calculate from _serving field > generic field (risky)
const getNutrientPer100g = (
  nutriments: OpenFoodFactsNutriments,
  field100g: keyof OpenFoodFactsNutriments,
  fieldServing: keyof OpenFoodFactsNutriments,
  servingGrams: number
): number => {
  // First try the explicit per-100g field
  const per100g = nutriments[field100g];
  if (per100g !== undefined && per100g > 0) {
    return per100g;
  }

  // If we have per-serving data and know the serving size, calculate per-100g
  const perServing = nutriments[fieldServing];
  if (perServing !== undefined && perServing > 0 && servingGrams > 0) {
    return (perServing / servingGrams) * 100;
  }

  return 0;
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
    const nutriments: OpenFoodFactsNutriments = product.nutriments || {};

    // Get serving size info from the product
    const servingSize = product.serving_size || '100g';
    const servingQuantity = product.serving_quantity
      ? parseFloat(product.serving_quantity)
      : 0;

    // Calculate calories per 100g
    // First try kcal fields, then try kJ fields and convert (1 kcal = 4.184 kJ)
    let caloriesPer100g = getNutrientPer100g(
      nutriments,
      'energy-kcal_100g',
      'energy-kcal_serving',
      servingQuantity
    );

    // If no kcal data, try kilojoules and convert
    if (caloriesPer100g === 0) {
      const kjPer100g = getNutrientPer100g(
        nutriments,
        'energy-kj_100g',
        'energy-kj_serving',
        servingQuantity
      );
      if (kjPer100g > 0) {
        caloriesPer100g = kjPer100g / 4.184;
      }
    }

    // Last resort: try generic energy field (usually in kJ)
    if (caloriesPer100g === 0) {
      const energyPer100g = getNutrientPer100g(
        nutriments,
        'energy_100g',
        'energy_serving',
        servingQuantity
      );
      if (energyPer100g > 0) {
        // If value > 400, it's likely kJ (oats are ~1600kJ/100g vs ~380kcal/100g)
        caloriesPer100g = energyPer100g > 400 ? energyPer100g / 4.184 : energyPer100g;
      }
    }
    const proteinPer100g = getNutrientPer100g(
      nutriments,
      'proteins_100g',
      'proteins_serving',
      servingQuantity
    );
    const carbsPer100g = getNutrientPer100g(
      nutriments,
      'carbohydrates_100g',
      'carbohydrates_serving',
      servingQuantity
    );
    const fatPer100g = getNutrientPer100g(
      nutriments,
      'fat_100g',
      'fat_serving',
      servingQuantity
    );

    // Detect if this is a piece-based food by checking the SERVING SIZE string
    // Only use pieces if we can extract both a piece count AND grams from the serving
    const productName = (product.product_name || product.product_name_en || '').toLowerCase();
    const servingSizeLower = servingSize.toLowerCase();

    // Keywords that indicate countable items - only check in serving size, not product name
    // Using specific food words, avoiding ambiguous terms like "bar", "mini", "pop"
    const pieceUnits = ['piece', 'nugget', 'wing', 'strip', 'tender', 'patty', 'biscuit',
                        'wafer', 'pretzel', 'popper', 'tot', 'bite', 'roll', 'pocket',
                        'stick', 'dog', 'dino', 'buddies'];

    // Try to extract piece count and grams from serving size
    // Examples: "4 pieces (84g)", "5 nuggets (87g)", "About 13 chips (28g)", "84g (about 4 pieces)"
    let gramsPerPiece: number | undefined;
    let piecesPerServing = 1;
    let isPieceBased = false;

    // Look for pattern like "X pieces" or "X nuggets" in the serving size
    const pieceMatch = servingSizeLower.match(/(\d+)\s*(piece|nugget|wing|strip|tender|patty|biscuit|wafer|pretzel|popper|tot|bite|roll|pocket|stick|dog|dino)/i);

    // Extract grams from serving size
    let gramsFromServing = servingQuantity;
    if (!gramsFromServing || gramsFromServing <= 0) {
      const gramsMatch = servingSizeLower.match(/(\d+)\s*g(?:ram)?/i);
      if (gramsMatch) {
        gramsFromServing = parseInt(gramsMatch[1]);
      }
    }

    // Only use piece-based if we found BOTH a piece count AND gram weight in the serving
    if (pieceMatch && gramsFromServing > 0) {
      piecesPerServing = parseInt(pieceMatch[1]) || 1;
      gramsPerPiece = gramsFromServing / piecesPerServing;
      isPieceBased = true;
    } else if (gramsFromServing > 0) {
      // Special case: product name strongly suggests pieces (nuggets, dinos)
      // AND serving size has grams but no explicit piece count
      const isDefinitelyPieces = productName.includes('nugget') ||
                                  productName.includes('dino') ||
                                  (productName.includes('buddies') && productName.includes('dino'));
      if (isDefinitelyPieces) {
        // Estimate: nuggets are typically 15-25g each
        gramsPerPiece = 21;
        piecesPerServing = Math.round(gramsFromServing / gramsPerPiece);
        isPieceBased = true;
      }
    }

    // Build available units
    const availableUnits: ('g' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'ml')[] = ['g', 'oz'];
    if (isPieceBased && gramsPerPiece) {
      availableUnits.unshift('piece'); // Add piece as first option
    } else {
      availableUnits.push('tbsp');
    }

    // Build a better serving size display for piece-based foods
    let displayServingSize = servingSize;
    if (isPieceBased && gramsPerPiece) {
      displayServingSize = `1 piece (${Math.round(gramsPerPiece)}g)`;
    }

    return {
      id: barcode,
      name: product.product_name || product.product_name_en || 'Unknown Product',
      // Store nutrition per 100g
      calories: Math.round(caloriesPer100g),
      protein: Math.round(proteinPer100g * 10) / 10,
      carbs: Math.round(carbsPer100g * 10) / 10,
      fat: Math.round(fatPer100g * 10) / 10,
      // servingSize is for display
      servingSize: displayServingSize,
      // servingGrams = 100 because nutrition values are per 100g
      servingGrams: 100,
      defaultUnit: isPieceBased && gramsPerPiece ? 'piece' : 'g',
      availableUnits,
      // Store grams per piece for piece-based foods, or serving quantity for others
      gramsPerCup: gramsPerPiece || (servingQuantity > 0 ? servingQuantity : undefined),
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

  // Fairlife Products
  { id: 'fairlife-2percent', name: 'Fairlife Milk 2%', calories: 120, protein: 13, carbs: 6, fat: 4.5, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'fairlife-whole', name: 'Fairlife Milk Whole', calories: 150, protein: 13, carbs: 6, fat: 8, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'fairlife-skim', name: 'Fairlife Milk Fat Free', calories: 80, protein: 13, carbs: 6, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'fairlife-chocolate', name: 'Fairlife Chocolate Milk', calories: 140, protein: 13, carbs: 13, fat: 4.5, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'fairlife-core-power', name: 'Fairlife Core Power Protein Shake', calories: 170, protein: 26, carbs: 8, fat: 4.5, servingSize: '1 bottle (340ml)', servingGrams: 340, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'fairlife-core-power-elite', name: 'Fairlife Core Power Elite', calories: 230, protein: 42, carbs: 8, fat: 4.5, servingSize: '1 bottle (414ml)', servingGrams: 414, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'fairlife-nutrition-plan', name: 'Fairlife Nutrition Plan Shake', calories: 150, protein: 30, carbs: 2, fat: 2.5, servingSize: '1 bottle (340ml)', servingGrams: 340, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },

  // More Protein Shakes & Drinks
  { id: 'premier-protein', name: 'Premier Protein Shake', calories: 160, protein: 30, carbs: 5, fat: 3, servingSize: '1 bottle (340ml)', servingGrams: 340, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'muscle-milk', name: 'Muscle Milk Protein Shake', calories: 160, protein: 25, carbs: 9, fat: 3, servingSize: '1 bottle (414ml)', servingGrams: 414, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'ensure-protein', name: 'Ensure Max Protein', calories: 150, protein: 30, carbs: 6, fat: 1.5, servingSize: '1 bottle (330ml)', servingGrams: 330, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'orgain-protein', name: 'Orgain Organic Protein Shake', calories: 150, protein: 16, carbs: 15, fat: 3, servingSize: '1 bottle (330ml)', servingGrams: 330, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'ghost-protein', name: 'Ghost Whey Protein', calories: 130, protein: 25, carbs: 4, fat: 1.5, servingSize: '1 scoop (36g)', servingGrams: 36, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'optimum-nutrition-gold', name: 'Optimum Nutrition Gold Standard Whey', calories: 120, protein: 24, carbs: 3, fat: 1, servingSize: '1 scoop (31g)', servingGrams: 31, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'dymatize-iso100', name: 'Dymatize ISO100 Protein', calories: 110, protein: 25, carbs: 1, fat: 0, servingSize: '1 scoop (32g)', servingGrams: 32, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // More Milk & Dairy Alternatives
  { id: 'oat-milk', name: 'Oat Milk', calories: 120, protein: 3, carbs: 16, fat: 5, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'soy-milk', name: 'Soy Milk', calories: 80, protein: 7, carbs: 4, fat: 4, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'coconut-milk', name: 'Coconut Milk (beverage)', calories: 45, protein: 0, carbs: 1, fat: 4, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'cashew-milk', name: 'Cashew Milk', calories: 25, protein: 1, carbs: 1, fat: 2, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'whole-milk', name: 'Whole Milk', calories: 149, protein: 8, carbs: 12, fat: 8, servingSize: '1 cup (244ml)', servingGrams: 244, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 244 },
  { id: 'skim-milk', name: 'Skim Milk', calories: 83, protein: 8, carbs: 12, fat: 0, servingSize: '1 cup (244ml)', servingGrams: 244, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 244 },
  { id: 'lactose-free-milk', name: 'Lactose Free Milk (2%)', calories: 120, protein: 8, carbs: 12, fat: 5, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },

  // Yogurt & Dairy
  { id: 'chobani-greek', name: 'Chobani Greek Yogurt', calories: 120, protein: 14, carbs: 8, fat: 3, servingSize: '1 container (150g)', servingGrams: 150, defaultUnit: 'g', availableUnits: ['g', 'piece'] },
  { id: 'fage-greek', name: 'Fage Total 0% Greek Yogurt', calories: 90, protein: 18, carbs: 5, fat: 0, servingSize: '1 container (170g)', servingGrams: 170, defaultUnit: 'g', availableUnits: ['g', 'piece'] },
  { id: 'siggi-yogurt', name: 'Siggi\'s Icelandic Yogurt', calories: 100, protein: 15, carbs: 8, fat: 0, servingSize: '1 container (150g)', servingGrams: 150, defaultUnit: 'g', availableUnits: ['g', 'piece'] },
  { id: 'oikos-triple-zero', name: 'Oikos Triple Zero Greek Yogurt', calories: 100, protein: 15, carbs: 7, fat: 0, servingSize: '1 container (150g)', servingGrams: 150, defaultUnit: 'g', availableUnits: ['g', 'piece'] },
  { id: 'skyr', name: 'Skyr (Icelandic Yogurt)', calories: 110, protein: 19, carbs: 7, fat: 0, servingSize: '1 container (150g)', servingGrams: 150, defaultUnit: 'g', availableUnits: ['g', 'cup'], gramsPerCup: 227 },
  { id: 'regular-yogurt', name: 'Yogurt (regular, plain)', calories: 100, protein: 5, carbs: 11, fat: 4, servingSize: '1 container (170g)', servingGrams: 170, defaultUnit: 'g', availableUnits: ['g', 'cup'], gramsPerCup: 245 },
  { id: 'parmesan-cheese', name: 'Parmesan Cheese', calories: 110, protein: 10, carbs: 1, fat: 7, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'tbsp'] },
  { id: 'swiss-cheese', name: 'Swiss Cheese', calories: 108, protein: 8, carbs: 2, fat: 8, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'feta-cheese', name: 'Feta Cheese', calories: 75, protein: 4, carbs: 1, fat: 6, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'ricotta-cheese', name: 'Ricotta Cheese', calories: 174, protein: 14, carbs: 6, fat: 10, servingSize: '1/2 cup (124g)', servingGrams: 124, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 248 },
  { id: 'sour-cream', name: 'Sour Cream', calories: 60, protein: 1, carbs: 1, fat: 6, servingSize: '2 tbsp (30g)', servingGrams: 30, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g', 'cup'], gramsPerCup: 240 },

  // Legumes & Beans
  { id: 'black-beans', name: 'Black Beans', calories: 132, protein: 9, carbs: 24, fat: 1, servingSize: '1/2 cup (86g)', servingGrams: 86, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 172 },
  { id: 'chickpeas', name: 'Chickpeas (Garbanzo Beans)', calories: 134, protein: 7, carbs: 22, fat: 2, servingSize: '1/2 cup (82g)', servingGrams: 82, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 164 },
  { id: 'lentils', name: 'Lentils (cooked)', calories: 115, protein: 9, carbs: 20, fat: 0, servingSize: '1/2 cup (99g)', servingGrams: 99, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 198 },
  { id: 'kidney-beans', name: 'Kidney Beans', calories: 112, protein: 8, carbs: 20, fat: 0, servingSize: '1/2 cup (89g)', servingGrams: 89, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 178 },
  { id: 'pinto-beans', name: 'Pinto Beans', calories: 122, protein: 8, carbs: 22, fat: 1, servingSize: '1/2 cup (86g)', servingGrams: 86, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 172 },
  { id: 'edamame', name: 'Edamame (shelled)', calories: 95, protein: 9, carbs: 7, fat: 4, servingSize: '1/2 cup (75g)', servingGrams: 75, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 150 },
  { id: 'tofu', name: 'Tofu (firm)', calories: 144, protein: 17, carbs: 3, fat: 8, servingSize: '1/2 cup (126g)', servingGrams: 126, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 252 },
  { id: 'tempeh', name: 'Tempeh', calories: 160, protein: 15, carbs: 9, fat: 9, servingSize: '3 oz (84g)', servingGrams: 84, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },

  // More Breakfast Items
  { id: 'cheerios', name: 'Cheerios', calories: 100, protein: 3, carbs: 20, fat: 2, servingSize: '1 cup (28g)', servingGrams: 28, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 28 },
  { id: 'special-k', name: 'Special K Cereal', calories: 120, protein: 6, carbs: 23, fat: 0.5, servingSize: '1 cup (31g)', servingGrams: 31, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 31 },
  { id: 'frosted-flakes', name: 'Frosted Flakes', calories: 130, protein: 1, carbs: 32, fat: 0, servingSize: '1 cup (37g)', servingGrams: 37, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 37 },
  { id: 'raisin-bran', name: 'Raisin Bran', calories: 190, protein: 5, carbs: 46, fat: 1, servingSize: '1 cup (59g)', servingGrams: 59, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 59 },
  { id: 'life-cereal', name: 'Life Cereal', calories: 120, protein: 3, carbs: 25, fat: 1.5, servingSize: '3/4 cup (32g)', servingGrams: 32, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 43 },
  { id: 'pancakes', name: 'Pancakes (plain)', calories: 175, protein: 5, carbs: 22, fat: 7, servingSize: '2 pancakes (116g)', servingGrams: 116, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'waffles', name: 'Waffles (frozen)', calories: 95, protein: 2, carbs: 15, fat: 3, servingSize: '1 waffle (35g)', servingGrams: 35, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'english-muffin', name: 'English Muffin', calories: 134, protein: 5, carbs: 26, fat: 1, servingSize: '1 muffin (57g)', servingGrams: 57, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'croissant', name: 'Croissant', calories: 231, protein: 5, carbs: 26, fat: 12, servingSize: '1 croissant (57g)', servingGrams: 57, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'muffin-blueberry', name: 'Blueberry Muffin', calories: 385, protein: 6, carbs: 54, fat: 17, servingSize: '1 muffin (113g)', servingGrams: 113, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'overnight-oats', name: 'Overnight Oats (basic)', calories: 250, protein: 10, carbs: 38, fat: 7, servingSize: '1 cup (240g)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 240 },

  // Fast Food
  { id: 'mcdonalds-bigmac', name: 'McDonald\'s Big Mac', calories: 550, protein: 25, carbs: 45, fat: 30, servingSize: '1 burger (215g)', servingGrams: 215, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-mcchicken', name: 'McDonald\'s McChicken', calories: 400, protein: 14, carbs: 39, fat: 21, servingSize: '1 sandwich (143g)', servingGrams: 143, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-fries-medium', name: 'McDonald\'s Fries (Medium)', calories: 320, protein: 5, carbs: 43, fat: 15, servingSize: '1 serving (111g)', servingGrams: 111, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-nuggets-10pc', name: 'McDonald\'s Chicken Nuggets (10pc)', calories: 410, protein: 23, carbs: 26, fat: 24, servingSize: '10 pieces (160g)', servingGrams: 160, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'chipotle-bowl', name: 'Chipotle Burrito Bowl (chicken)', calories: 660, protein: 50, carbs: 51, fat: 26, servingSize: '1 bowl (510g)', servingGrams: 510, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'chipotle-burrito', name: 'Chipotle Burrito (chicken)', calories: 985, protein: 55, carbs: 102, fat: 38, servingSize: '1 burrito (610g)', servingGrams: 610, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'subway-turkey', name: 'Subway Turkey Sub (6 inch)', calories: 280, protein: 18, carbs: 40, fat: 4, servingSize: '1 sandwich (217g)', servingGrams: 217, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'chick-fil-a-sandwich', name: 'Chick-fil-A Chicken Sandwich', calories: 440, protein: 28, carbs: 40, fat: 19, servingSize: '1 sandwich (143g)', servingGrams: 143, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'chick-fil-a-nuggets-8pc', name: 'Chick-fil-A Nuggets (8pc)', calories: 250, protein: 27, carbs: 11, fat: 11, servingSize: '8 pieces (113g)', servingGrams: 113, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'wendys-baconator', name: 'Wendy\'s Baconator', calories: 950, protein: 57, carbs: 38, fat: 62, servingSize: '1 burger (282g)', servingGrams: 282, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'taco-bell-taco', name: 'Taco Bell Crunchy Taco', calories: 170, protein: 8, carbs: 13, fat: 9, servingSize: '1 taco (78g)', servingGrams: 78, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'taco-bell-burrito', name: 'Taco Bell Bean Burrito', calories: 380, protein: 13, carbs: 55, fat: 11, servingSize: '1 burrito (198g)', servingGrams: 198, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'five-guys-burger', name: 'Five Guys Little Hamburger', calories: 540, protein: 27, carbs: 39, fat: 32, servingSize: '1 burger (195g)', servingGrams: 195, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'in-n-out-double', name: 'In-N-Out Double-Double', calories: 670, protein: 37, carbs: 39, fat: 41, servingSize: '1 burger (330g)', servingGrams: 330, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Condiments & Sauces
  { id: 'ketchup', name: 'Ketchup', calories: 20, protein: 0, carbs: 5, fat: 0, servingSize: '1 tbsp (17g)', servingGrams: 17, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'mustard', name: 'Mustard', calories: 3, protein: 0, carbs: 0, fat: 0, servingSize: '1 tsp (5g)', servingGrams: 5, defaultUnit: 'tsp', availableUnits: ['tsp', 'tbsp', 'g'] },
  { id: 'mayonnaise', name: 'Mayonnaise', calories: 94, protein: 0, carbs: 0, fat: 10, servingSize: '1 tbsp (13g)', servingGrams: 13, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'mayo-light', name: 'Mayonnaise (light)', calories: 35, protein: 0, carbs: 1, fat: 3, servingSize: '1 tbsp (15g)', servingGrams: 15, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'bbq-sauce', name: 'BBQ Sauce', calories: 29, protein: 0, carbs: 7, fat: 0, servingSize: '1 tbsp (17g)', servingGrams: 17, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'hot-sauce', name: 'Hot Sauce', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '1 tsp (5g)', servingGrams: 5, defaultUnit: 'tsp', availableUnits: ['tsp', 'tbsp', 'ml'] },
  { id: 'soy-sauce', name: 'Soy Sauce', calories: 9, protein: 1, carbs: 1, fat: 0, servingSize: '1 tbsp (16g)', servingGrams: 16, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'ml', 'g'] },
  { id: 'ranch-dressing', name: 'Ranch Dressing', calories: 73, protein: 0, carbs: 1, fat: 8, servingSize: '1 tbsp (15g)', servingGrams: 15, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'italian-dressing', name: 'Italian Dressing', calories: 43, protein: 0, carbs: 2, fat: 4, servingSize: '1 tbsp (15g)', servingGrams: 15, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'balsamic-vinaigrette', name: 'Balsamic Vinaigrette', calories: 45, protein: 0, carbs: 3, fat: 4, servingSize: '1 tbsp (15g)', servingGrams: 15, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'caesar-dressing', name: 'Caesar Dressing', calories: 78, protein: 1, carbs: 0, fat: 8, servingSize: '1 tbsp (15g)', servingGrams: 15, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'salsa', name: 'Salsa', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '2 tbsp (30g)', servingGrams: 30, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g', 'cup'], gramsPerCup: 240 },
  { id: 'guacamole', name: 'Guacamole', calories: 50, protein: 1, carbs: 3, fat: 4, servingSize: '2 tbsp (30g)', servingGrams: 30, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },
  { id: 'sriracha', name: 'Sriracha', calories: 5, protein: 0, carbs: 1, fat: 0, servingSize: '1 tsp (5g)', servingGrams: 5, defaultUnit: 'tsp', availableUnits: ['tsp', 'tbsp', 'g'] },
  { id: 'maple-syrup', name: 'Maple Syrup', calories: 52, protein: 0, carbs: 13, fat: 0, servingSize: '1 tbsp (20g)', servingGrams: 20, defaultUnit: 'tbsp', availableUnits: ['tbsp', 'g'] },

  // More Snacks
  { id: 'protein-bar-quest', name: 'Quest Protein Bar', calories: 190, protein: 21, carbs: 21, fat: 8, servingSize: '1 bar (60g)', servingGrams: 60, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'protein-bar-rxbar', name: 'RXBar', calories: 210, protein: 12, carbs: 24, fat: 9, servingSize: '1 bar (52g)', servingGrams: 52, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'protein-bar-kind', name: 'KIND Protein Bar', calories: 250, protein: 12, carbs: 18, fat: 17, servingSize: '1 bar (50g)', servingGrams: 50, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cliff-bar', name: 'Clif Bar', calories: 250, protein: 9, carbs: 44, fat: 6, servingSize: '1 bar (68g)', servingGrams: 68, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'nature-valley-bar', name: 'Nature Valley Granola Bar', calories: 190, protein: 4, carbs: 29, fat: 7, servingSize: '2 bars (42g)', servingGrams: 42, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'beef-jerky', name: 'Beef Jerky', calories: 116, protein: 9, carbs: 3, fat: 7, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'trail-mix', name: 'Trail Mix', calories: 173, protein: 5, carbs: 15, fat: 11, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'cup'], gramsPerCup: 140 },
  { id: 'pretzels', name: 'Pretzels', calories: 108, protein: 3, carbs: 23, fat: 1, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'crackers-graham', name: 'Graham Crackers', calories: 59, protein: 1, carbs: 11, fat: 1, servingSize: '2 crackers (14g)', servingGrams: 14, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'crackers-saltine', name: 'Saltine Crackers', calories: 13, protein: 0, carbs: 2, fat: 0, servingSize: '1 cracker (3g)', servingGrams: 3, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cheezits', name: 'Cheez-Its', calories: 150, protein: 4, carbs: 17, fat: 8, servingSize: '27 crackers (30g)', servingGrams: 30, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'goldfish', name: 'Goldfish Crackers', calories: 140, protein: 3, carbs: 20, fat: 5, servingSize: '55 pieces (30g)', servingGrams: 30, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'tortilla-chips', name: 'Tortilla Chips', calories: 140, protein: 2, carbs: 18, fat: 7, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'doritos', name: 'Doritos', calories: 150, protein: 2, carbs: 18, fat: 8, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'lays-chips', name: 'Lay\'s Classic Chips', calories: 160, protein: 2, carbs: 15, fat: 10, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'pringles', name: 'Pringles', calories: 150, protein: 1, carbs: 15, fat: 9, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },

  // More Fruit
  { id: 'raspberries', name: 'Raspberries', calories: 64, protein: 1, carbs: 15, fat: 1, servingSize: '1 cup (123g)', servingGrams: 123, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 123 },
  { id: 'blackberries', name: 'Blackberries', calories: 62, protein: 2, carbs: 14, fat: 1, servingSize: '1 cup (144g)', servingGrams: 144, defaultUnit: 'cup', availableUnits: ['cup', 'g', 'oz'], gramsPerCup: 144 },
  { id: 'cantaloupe', name: 'Cantaloupe', calories: 54, protein: 1, carbs: 13, fat: 0, servingSize: '1 cup (160g)', servingGrams: 160, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 160 },
  { id: 'honeydew', name: 'Honeydew', calories: 61, protein: 1, carbs: 15, fat: 0, servingSize: '1 cup (177g)', servingGrams: 177, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 177 },
  { id: 'peach', name: 'Peach', calories: 59, protein: 1, carbs: 14, fat: 0, servingSize: '1 medium (150g)', servingGrams: 150, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'pear', name: 'Pear', calories: 102, protein: 1, carbs: 27, fat: 0, servingSize: '1 medium (178g)', servingGrams: 178, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'plum', name: 'Plum', calories: 30, protein: 0, carbs: 8, fat: 0, servingSize: '1 plum (66g)', servingGrams: 66, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cherries', name: 'Cherries', calories: 87, protein: 1, carbs: 22, fat: 0, servingSize: '1 cup (138g)', servingGrams: 138, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 138 },
  { id: 'grapefruit', name: 'Grapefruit', calories: 52, protein: 1, carbs: 13, fat: 0, servingSize: '1/2 grapefruit (123g)', servingGrams: 123, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'kiwi', name: 'Kiwi', calories: 42, protein: 1, carbs: 10, fat: 0, servingSize: '1 kiwi (69g)', servingGrams: 69, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'papaya', name: 'Papaya', calories: 62, protein: 1, carbs: 16, fat: 0, servingSize: '1 cup (145g)', servingGrams: 145, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 145 },
  { id: 'pomegranate', name: 'Pomegranate Seeds', calories: 72, protein: 1, carbs: 16, fat: 1, servingSize: '1/2 cup (87g)', servingGrams: 87, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 174 },
  { id: 'dried-cranberries', name: 'Dried Cranberries', calories: 123, protein: 0, carbs: 33, fat: 0, servingSize: '1/4 cup (40g)', servingGrams: 40, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 160 },
  { id: 'raisins', name: 'Raisins', calories: 129, protein: 1, carbs: 34, fat: 0, servingSize: '1/4 cup (40g)', servingGrams: 40, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 160 },
  { id: 'dates', name: 'Dates (medjool)', calories: 66, protein: 0, carbs: 18, fat: 0, servingSize: '1 date (24g)', servingGrams: 24, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // More Seafood
  { id: 'cod', name: 'Cod (baked)', calories: 90, protein: 20, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'tilapia', name: 'Tilapia', calories: 111, protein: 23, carbs: 0, fat: 2, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'halibut', name: 'Halibut', calories: 111, protein: 23, carbs: 0, fat: 2, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'mahi-mahi', name: 'Mahi Mahi', calories: 97, protein: 21, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'trout', name: 'Rainbow Trout', calories: 141, protein: 20, carbs: 0, fat: 6, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'sardines', name: 'Sardines (canned in oil)', calories: 208, protein: 25, carbs: 0, fat: 11, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'crab', name: 'Crab Meat', calories: 97, protein: 21, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'lobster', name: 'Lobster', calories: 89, protein: 19, carbs: 0, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'scallops', name: 'Scallops', calories: 111, protein: 21, carbs: 5, fat: 1, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'oysters', name: 'Oysters', calories: 68, protein: 7, carbs: 4, fat: 2, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz', 'piece'] },
  { id: 'sushi-roll', name: 'Sushi Roll (California)', calories: 255, protein: 9, carbs: 38, fat: 7, servingSize: '8 pieces (185g)', servingGrams: 185, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // More Meat
  { id: 'ribeye-steak', name: 'Ribeye Steak', calories: 291, protein: 24, carbs: 0, fat: 21, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'filet-mignon', name: 'Filet Mignon', calories: 267, protein: 26, carbs: 0, fat: 17, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'flank-steak', name: 'Flank Steak', calories: 192, protein: 29, carbs: 0, fat: 8, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'lamb-chop', name: 'Lamb Chop', calories: 294, protein: 25, carbs: 0, fat: 21, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'bison', name: 'Bison (ground)', calories: 146, protein: 20, carbs: 0, fat: 7, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'venison', name: 'Venison', calories: 158, protein: 30, carbs: 0, fat: 3, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'duck', name: 'Duck Breast', calories: 201, protein: 24, carbs: 0, fat: 11, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz'] },
  { id: 'ham', name: 'Ham (deli)', calories: 145, protein: 21, carbs: 1, fat: 6, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz', 'slice'] },
  { id: 'salami', name: 'Salami', calories: 378, protein: 22, carbs: 3, fat: 31, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz', 'slice'] },
  { id: 'pepperoni', name: 'Pepperoni', calories: 504, protein: 22, carbs: 0, fat: 46, servingSize: '100g', servingGrams: 100, defaultUnit: 'g', availableUnits: ['g', 'oz', 'slice'] },
  { id: 'hot-dog', name: 'Hot Dog (beef)', calories: 290, protein: 11, carbs: 2, fat: 26, servingSize: '1 hot dog (57g)', servingGrams: 57, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'sausage-italian', name: 'Italian Sausage', calories: 293, protein: 16, carbs: 2, fat: 24, servingSize: '1 link (83g)', servingGrams: 83, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'breakfast-sausage', name: 'Breakfast Sausage', calories: 114, protein: 4, carbs: 1, fat: 10, servingSize: '1 patty (27g)', servingGrams: 27, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Drinks & Energy
  { id: 'gatorade', name: 'Gatorade', calories: 80, protein: 0, carbs: 21, fat: 0, servingSize: '12 oz (360ml)', servingGrams: 360, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'powerade', name: 'Powerade', calories: 80, protein: 0, carbs: 21, fat: 0, servingSize: '12 oz (360ml)', servingGrams: 360, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'body-armor', name: 'BodyArmor', calories: 70, protein: 0, carbs: 18, fat: 0, servingSize: '12 oz (360ml)', servingGrams: 360, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'redbull', name: 'Red Bull', calories: 110, protein: 0, carbs: 28, fat: 0, servingSize: '8.4 oz (250ml)', servingGrams: 250, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'monster-energy', name: 'Monster Energy', calories: 110, protein: 0, carbs: 27, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'celsius', name: 'Celsius Energy Drink', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'bang-energy', name: 'Bang Energy', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'protein-water', name: 'Protein Water (Premier)', calories: 70, protein: 15, carbs: 1, fat: 0, servingSize: '1 bottle (500ml)', servingGrams: 500, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'coconut-water', name: 'Coconut Water', calories: 45, protein: 0, carbs: 11, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'apple-juice', name: 'Apple Juice', calories: 114, protein: 0, carbs: 28, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'cranberry-juice', name: 'Cranberry Juice', calories: 116, protein: 0, carbs: 31, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'green-tea', name: 'Green Tea (unsweetened)', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'iced-tea', name: 'Iced Tea (sweetened)', calories: 90, protein: 0, carbs: 23, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'lemonade', name: 'Lemonade', calories: 99, protein: 0, carbs: 26, fat: 0, servingSize: '1 cup (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml', 'oz'], gramsPerCup: 240 },
  { id: 'smoothie-fruit', name: 'Fruit Smoothie (generic)', calories: 230, protein: 4, carbs: 50, fat: 2, servingSize: '16 oz (475ml)', servingGrams: 475, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Desserts
  { id: 'ice-cream-vanilla', name: 'Vanilla Ice Cream', calories: 137, protein: 2, carbs: 16, fat: 7, servingSize: '1/2 cup (66g)', servingGrams: 66, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 132 },
  { id: 'ice-cream-chocolate', name: 'Chocolate Ice Cream', calories: 143, protein: 3, carbs: 19, fat: 7, servingSize: '1/2 cup (66g)', servingGrams: 66, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 132 },
  { id: 'frozen-yogurt', name: 'Frozen Yogurt', calories: 114, protein: 3, carbs: 22, fat: 2, servingSize: '1/2 cup (72g)', servingGrams: 72, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 144 },
  { id: 'halo-top', name: 'Halo Top Ice Cream', calories: 70, protein: 5, carbs: 14, fat: 2, servingSize: '1/2 cup (64g)', servingGrams: 64, defaultUnit: 'cup', availableUnits: ['cup', 'g'], gramsPerCup: 128 },
  { id: 'brownie', name: 'Brownie', calories: 227, protein: 3, carbs: 36, fat: 9, servingSize: '1 piece (56g)', servingGrams: 56, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cookie-chocolate-chip', name: 'Chocolate Chip Cookie', calories: 148, protein: 2, carbs: 20, fat: 7, servingSize: '1 cookie (30g)', servingGrams: 30, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'oreo', name: 'Oreo Cookie', calories: 53, protein: 1, carbs: 8, fat: 2, servingSize: '1 cookie (11g)', servingGrams: 11, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cheesecake', name: 'Cheesecake', calories: 321, protein: 5, carbs: 26, fat: 22, servingSize: '1 slice (80g)', servingGrams: 80, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'donut', name: 'Donut (glazed)', calories: 269, protein: 4, carbs: 31, fat: 15, servingSize: '1 donut (60g)', servingGrams: 60, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'cake-chocolate', name: 'Chocolate Cake', calories: 352, protein: 5, carbs: 51, fat: 14, servingSize: '1 slice (95g)', servingGrams: 95, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Diet & Zero Calorie Sodas
  { id: 'diet-coke', name: 'Diet Coke', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'coke-zero', name: 'Coca-Cola Zero Sugar', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'diet-pepsi', name: 'Diet Pepsi', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'pepsi-zero', name: 'Pepsi Zero Sugar', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'sprite-zero', name: 'Sprite Zero', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'diet-dr-pepper', name: 'Diet Dr Pepper', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'dr-pepper-zero', name: 'Dr Pepper Zero Sugar', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'diet-mountain-dew', name: 'Diet Mountain Dew', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'mountain-dew-zero', name: 'Mountain Dew Zero Sugar', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'fanta-zero', name: 'Fanta Zero', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'a-and-w-zero', name: 'A&W Zero Sugar Root Beer', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'canada-dry-zero', name: 'Canada Dry Zero Sugar Ginger Ale', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'fresca', name: 'Fresca', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'zevia', name: 'Zevia (zero calorie soda)', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Regular Sodas
  { id: 'coca-cola', name: 'Coca-Cola', calories: 140, protein: 0, carbs: 39, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'pepsi', name: 'Pepsi', calories: 150, protein: 0, carbs: 41, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'sprite', name: 'Sprite', calories: 140, protein: 0, carbs: 38, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'dr-pepper', name: 'Dr Pepper', calories: 150, protein: 0, carbs: 40, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'mountain-dew', name: 'Mountain Dew', calories: 170, protein: 0, carbs: 46, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'fanta-orange', name: 'Fanta Orange', calories: 160, protein: 0, carbs: 44, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'root-beer', name: 'Root Beer', calories: 152, protein: 0, carbs: 40, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'ginger-ale', name: 'Ginger Ale', calories: 124, protein: 0, carbs: 32, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Flavored Water & Zero Calorie Drinks
  { id: 'lacroix', name: 'LaCroix Sparkling Water', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'bubly', name: 'Bubly Sparkling Water', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'spindrift', name: 'Spindrift Sparkling Water', calories: 15, protein: 0, carbs: 4, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'topo-chico', name: 'Topo Chico', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'perrier', name: 'Perrier', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '11 oz (330ml)', servingGrams: 330, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'san-pellegrino', name: 'San Pellegrino', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '11 oz (330ml)', servingGrams: 330, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'vitaminwater-zero', name: 'Vitaminwater Zero', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '20 oz (591ml)', servingGrams: 591, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'vitaminwater', name: 'Vitaminwater', calories: 100, protein: 0, carbs: 27, fat: 0, servingSize: '20 oz (591ml)', servingGrams: 591, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'propel', name: 'Propel Fitness Water', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '20 oz (591ml)', servingGrams: 591, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'bai', name: 'Bai Antioxidant Drink', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '18 oz (530ml)', servingGrams: 530, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'hint-water', name: 'Hint Water', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'crystal-light', name: 'Crystal Light', calories: 5, protein: 0, carbs: 0, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'mio-water', name: 'MiO Water Enhancer', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Coffee Drinks
  { id: 'starbucks-pike', name: 'Starbucks Pike Place (Grande)', calories: 5, protein: 1, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-latte', name: 'Starbucks Caffè Latte (Grande)', calories: 190, protein: 13, carbs: 18, fat: 7, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-caramel-macchiato', name: 'Starbucks Caramel Macchiato (Grande)', calories: 250, protein: 10, carbs: 35, fat: 7, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-mocha', name: 'Starbucks Caffè Mocha (Grande)', calories: 360, protein: 13, carbs: 47, fat: 14, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-cold-brew', name: 'Starbucks Cold Brew (Grande)', calories: 5, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-frappuccino', name: 'Starbucks Mocha Frappuccino (Grande)', calories: 370, protein: 5, carbs: 55, fat: 15, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-psl', name: 'Starbucks Pumpkin Spice Latte (Grande)', calories: 390, protein: 14, carbs: 52, fat: 14, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'starbucks-refresher', name: 'Starbucks Refresher (Grande)', calories: 90, protein: 0, carbs: 22, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'dunkin-coffee', name: 'Dunkin\' Coffee (Medium)', calories: 5, protein: 0, carbs: 0, fat: 0, servingSize: '14 oz (414ml)', servingGrams: 414, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'dunkin-latte', name: 'Dunkin\' Latte (Medium)', calories: 120, protein: 10, carbs: 12, fat: 4, servingSize: '14 oz (414ml)', servingGrams: 414, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'dunkin-iced-coffee', name: 'Dunkin\' Iced Coffee (Medium)', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '24 oz (710ml)', servingGrams: 710, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'bottled-starbucks-frap', name: 'Starbucks Bottled Frappuccino', calories: 200, protein: 6, carbs: 37, fat: 3, servingSize: '13.7 oz (405ml)', servingGrams: 405, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'bottled-starbucks-doubleshot', name: 'Starbucks Doubleshot', calories: 140, protein: 9, carbs: 18, fat: 4, servingSize: '15 oz (444ml)', servingGrams: 444, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'black-rifle-rtd', name: 'Black Rifle Coffee RTD', calories: 200, protein: 15, carbs: 21, fat: 6, servingSize: '11 oz (325ml)', servingGrams: 325, defaultUnit: 'ml', availableUnits: ['ml', 'piece'] },
  { id: 'coffee-with-cream', name: 'Coffee with Cream', calories: 52, protein: 1, carbs: 1, fat: 5, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'coffee-with-sugar', name: 'Coffee with Sugar', calories: 35, protein: 0, carbs: 9, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'espresso-shot', name: 'Espresso (1 shot)', calories: 3, protein: 0, carbs: 0, fat: 0, servingSize: '1 oz (30ml)', servingGrams: 30, defaultUnit: 'piece', availableUnits: ['piece', 'ml'] },
  { id: 'cappuccino', name: 'Cappuccino', calories: 80, protein: 4, carbs: 6, fat: 4, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'americano', name: 'Americano', calories: 15, protein: 1, carbs: 2, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Tea
  { id: 'chai-latte', name: 'Chai Tea Latte', calories: 190, protein: 4, carbs: 38, fat: 2, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'matcha-latte', name: 'Matcha Latte', calories: 190, protein: 6, carbs: 32, fat: 4, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'black-tea', name: 'Black Tea (unsweetened)', calories: 2, protein: 0, carbs: 0, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'cup', availableUnits: ['cup', 'ml'], gramsPerCup: 240 },
  { id: 'arizona-green-tea', name: 'Arizona Green Tea', calories: 70, protein: 0, carbs: 18, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'arizona-arnold-palmer', name: 'Arizona Arnold Palmer', calories: 90, protein: 0, carbs: 23, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'honest-tea', name: 'Honest Tea', calories: 70, protein: 0, carbs: 18, fat: 0, servingSize: '16.9 oz (500ml)', servingGrams: 500, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'pure-leaf-tea', name: 'Pure Leaf Iced Tea', calories: 160, protein: 0, carbs: 42, fat: 0, servingSize: '18.5 oz (547ml)', servingGrams: 547, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'pure-leaf-unsweetened', name: 'Pure Leaf Unsweetened Tea', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '18.5 oz (547ml)', servingGrams: 547, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'gold-peak-tea', name: 'Gold Peak Iced Tea', calories: 130, protein: 0, carbs: 34, fat: 0, servingSize: '18.5 oz (547ml)', servingGrams: 547, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'snapple', name: 'Snapple (Peach Tea)', calories: 160, protein: 0, carbs: 40, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'brisk-iced-tea', name: 'Brisk Iced Tea', calories: 90, protein: 0, carbs: 25, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // Zero Sugar Energy Drinks
  { id: 'redbull-zero', name: 'Red Bull Zero', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '8.4 oz (250ml)', servingGrams: 250, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'redbull-sugar-free', name: 'Red Bull Sugar Free', calories: 10, protein: 0, carbs: 3, fat: 0, servingSize: '8.4 oz (250ml)', servingGrams: 250, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'monster-zero-ultra', name: 'Monster Zero Ultra', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'monster-lo-carb', name: 'Monster Lo-Carb', calories: 30, protein: 0, carbs: 8, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'rockstar-zero', name: 'Rockstar Zero Carb', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'nos-zero', name: 'NOS Zero Sugar', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'c4-energy', name: 'C4 Energy Drink', calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'ghost-energy', name: 'Ghost Energy Drink', calories: 5, protein: 0, carbs: 1, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'reign-energy', name: 'Reign Total Body Fuel', calories: 10, protein: 0, carbs: 3, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'alani-nu-energy', name: 'Alani Nu Energy', calories: 10, protein: 0, carbs: 1, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: '3d-energy', name: '3D Energy Drink', calories: 15, protein: 0, carbs: 3, fat: 0, servingSize: '16 oz (473ml)', servingGrams: 473, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'prime-energy', name: 'Prime Energy', calories: 10, protein: 0, carbs: 2, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'prime-hydration', name: 'Prime Hydration', calories: 25, protein: 0, carbs: 6, fat: 0, servingSize: '16.9 oz (500ml)', servingGrams: 500, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'liquid-iv', name: 'Liquid I.V.', calories: 45, protein: 0, carbs: 11, fat: 0, servingSize: '1 packet (16g)', servingGrams: 16, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'drip-drop', name: 'DripDrop', calories: 35, protein: 0, carbs: 7, fat: 0, servingSize: '1 packet (10g)', servingGrams: 10, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // Alcohol (optional for tracking)
  { id: 'wine-white', name: 'White Wine', calories: 121, protein: 0, carbs: 4, fat: 0, servingSize: '5 oz (148ml)', servingGrams: 148, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'champagne', name: 'Champagne', calories: 84, protein: 0, carbs: 2, fat: 0, servingSize: '4 oz (120ml)', servingGrams: 120, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'beer-light', name: 'Light Beer', calories: 103, protein: 1, carbs: 6, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'beer-ipa', name: 'IPA Beer', calories: 200, protein: 2, carbs: 18, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'vodka', name: 'Vodka (1.5 oz shot)', calories: 97, protein: 0, carbs: 0, fat: 0, servingSize: '1.5 oz (44ml)', servingGrams: 44, defaultUnit: 'oz', availableUnits: ['oz', 'ml'] },
  { id: 'whiskey', name: 'Whiskey (1.5 oz shot)', calories: 105, protein: 0, carbs: 0, fat: 0, servingSize: '1.5 oz (44ml)', servingGrams: 44, defaultUnit: 'oz', availableUnits: ['oz', 'ml'] },
  { id: 'rum', name: 'Rum (1.5 oz shot)', calories: 97, protein: 0, carbs: 0, fat: 0, servingSize: '1.5 oz (44ml)', servingGrams: 44, defaultUnit: 'oz', availableUnits: ['oz', 'ml'] },
  { id: 'gin', name: 'Gin (1.5 oz shot)', calories: 97, protein: 0, carbs: 0, fat: 0, servingSize: '1.5 oz (44ml)', servingGrams: 44, defaultUnit: 'oz', availableUnits: ['oz', 'ml'] },
  { id: 'tequila', name: 'Tequila (1.5 oz shot)', calories: 97, protein: 0, carbs: 0, fat: 0, servingSize: '1.5 oz (44ml)', servingGrams: 44, defaultUnit: 'oz', availableUnits: ['oz', 'ml'] },
  { id: 'margarita', name: 'Margarita', calories: 274, protein: 0, carbs: 36, fat: 0, servingSize: '8 oz (240ml)', servingGrams: 240, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'white-claw', name: 'White Claw Hard Seltzer', calories: 100, protein: 0, carbs: 2, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'truly', name: 'Truly Hard Seltzer', calories: 100, protein: 0, carbs: 2, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },
  { id: 'michelob-ultra', name: 'Michelob Ultra', calories: 95, protein: 1, carbs: 3, fat: 0, servingSize: '12 oz (355ml)', servingGrams: 355, defaultUnit: 'ml', availableUnits: ['ml', 'oz'] },

  // More Fast Food
  { id: 'mcdonalds-quarter-pounder', name: 'McDonald\'s Quarter Pounder w/ Cheese', calories: 520, protein: 30, carbs: 42, fat: 26, servingSize: '1 burger (202g)', servingGrams: 202, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-filet-o-fish', name: 'McDonald\'s Filet-O-Fish', calories: 390, protein: 16, carbs: 39, fat: 19, servingSize: '1 sandwich (142g)', servingGrams: 142, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-mcmuffin', name: 'McDonald\'s Egg McMuffin', calories: 310, protein: 17, carbs: 30, fat: 13, servingSize: '1 sandwich (136g)', servingGrams: 136, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-hashbrown', name: 'McDonald\'s Hash Brown', calories: 140, protein: 1, carbs: 15, fat: 8, servingSize: '1 piece (56g)', servingGrams: 56, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'mcdonalds-mcgriddle', name: 'McDonald\'s McGriddle (Sausage, Egg, Cheese)', calories: 550, protein: 20, carbs: 42, fat: 32, servingSize: '1 sandwich (189g)', servingGrams: 189, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'burger-king-whopper', name: 'Burger King Whopper', calories: 660, protein: 28, carbs: 49, fat: 40, servingSize: '1 burger (270g)', servingGrams: 270, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'wendys-dave-single', name: 'Wendy\'s Dave\'s Single', calories: 570, protein: 30, carbs: 39, fat: 34, servingSize: '1 burger (202g)', servingGrams: 202, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'wendys-chicken-nuggets', name: 'Wendy\'s Chicken Nuggets (10pc)', calories: 420, protein: 23, carbs: 25, fat: 26, servingSize: '10 pieces (150g)', servingGrams: 150, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'popeyes-chicken-sandwich', name: 'Popeyes Chicken Sandwich', calories: 700, protein: 28, carbs: 50, fat: 42, servingSize: '1 sandwich (220g)', servingGrams: 220, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'kfc-original-breast', name: 'KFC Original Recipe Chicken Breast', calories: 390, protein: 39, carbs: 11, fat: 21, servingSize: '1 piece (161g)', servingGrams: 161, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'panda-orange-chicken', name: 'Panda Express Orange Chicken', calories: 490, protein: 25, carbs: 51, fat: 23, servingSize: '1 entree (168g)', servingGrams: 168, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'panda-fried-rice', name: 'Panda Express Fried Rice', calories: 520, protein: 11, carbs: 85, fat: 16, servingSize: '1 side (285g)', servingGrams: 285, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'chick-fil-a-waffle-fries', name: 'Chick-fil-A Waffle Fries (Medium)', calories: 420, protein: 5, carbs: 45, fat: 24, servingSize: '1 serving (125g)', servingGrams: 125, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'sonic-tots', name: 'Sonic Tater Tots (Medium)', calories: 360, protein: 3, carbs: 42, fat: 20, servingSize: '1 serving (128g)', servingGrams: 128, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'arbys-roast-beef', name: 'Arby\'s Classic Roast Beef', calories: 360, protein: 23, carbs: 37, fat: 14, servingSize: '1 sandwich (154g)', servingGrams: 154, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'jimmy-johns-sub', name: 'Jimmy John\'s Turkey Tom', calories: 510, protein: 24, carbs: 54, fat: 21, servingSize: '1 sandwich (227g)', servingGrams: 227, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'jersey-mikes-sub', name: 'Jersey Mike\'s Turkey Sub (Regular)', calories: 580, protein: 35, carbs: 55, fat: 24, servingSize: '1 sandwich (280g)', servingGrams: 280, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'firehouse-sub', name: 'Firehouse Subs Hook & Ladder (Medium)', calories: 560, protein: 32, carbs: 48, fat: 26, servingSize: '1 sandwich (250g)', servingGrams: 250, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'panera-broccoli-cheddar', name: 'Panera Broccoli Cheddar Soup (Bowl)', calories: 360, protein: 14, carbs: 29, fat: 21, servingSize: '1 bowl (340g)', servingGrams: 340, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'panera-mac-cheese', name: 'Panera Mac & Cheese', calories: 980, protein: 32, carbs: 92, fat: 53, servingSize: '1 bowl (397g)', servingGrams: 397, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'qdoba-bowl', name: 'Qdoba Burrito Bowl (chicken)', calories: 640, protein: 45, carbs: 50, fat: 28, servingSize: '1 bowl (480g)', servingGrams: 480, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'moes-burrito', name: 'Moe\'s Homewrecker Burrito', calories: 960, protein: 52, carbs: 96, fat: 40, servingSize: '1 burrito (580g)', servingGrams: 580, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'wingstop-wings', name: 'Wingstop Classic Wings (10pc)', calories: 860, protein: 75, carbs: 3, fat: 62, servingSize: '10 wings (280g)', servingGrams: 280, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'buffalo-wild-wings', name: 'Buffalo Wild Wings Traditional (10pc)', calories: 880, protein: 72, carbs: 6, fat: 64, servingSize: '10 wings (290g)', servingGrams: 290, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },

  // More Grocery Items
  { id: 'deli-turkey', name: 'Deli Turkey Breast', calories: 60, protein: 12, carbs: 2, fat: 1, servingSize: '2 oz (56g)', servingGrams: 56, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'deli-ham', name: 'Deli Ham', calories: 60, protein: 10, carbs: 2, fat: 1, servingSize: '2 oz (56g)', servingGrams: 56, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'deli-roast-beef', name: 'Deli Roast Beef', calories: 70, protein: 12, carbs: 1, fat: 2, servingSize: '2 oz (56g)', servingGrams: 56, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'string-cheese', name: 'String Cheese', calories: 80, protein: 7, carbs: 1, fat: 5, servingSize: '1 stick (28g)', servingGrams: 28, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'babybel', name: 'Mini Babybel Cheese', calories: 70, protein: 5, carbs: 0, fat: 6, servingSize: '1 piece (21g)', servingGrams: 21, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'laughing-cow', name: 'Laughing Cow Cheese Wedge', calories: 35, protein: 2, carbs: 1, fat: 2, servingSize: '1 wedge (21g)', servingGrams: 21, defaultUnit: 'piece', availableUnits: ['piece', 'g'] },
  { id: 'american-cheese', name: 'American Cheese (slice)', calories: 70, protein: 4, carbs: 1, fat: 6, servingSize: '1 slice (21g)', servingGrams: 21, defaultUnit: 'slice', availableUnits: ['slice', 'g', 'oz'] },
  { id: 'provolone-cheese', name: 'Provolone Cheese', calories: 100, protein: 7, carbs: 1, fat: 8, servingSize: '1 slice (28g)', servingGrams: 28, defaultUnit: 'slice', availableUnits: ['slice', 'g', 'oz'] },
  { id: 'colby-jack-cheese', name: 'Colby Jack Cheese', calories: 110, protein: 7, carbs: 0, fat: 9, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'pepper-jack-cheese', name: 'Pepper Jack Cheese', calories: 110, protein: 7, carbs: 0, fat: 9, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g', 'slice'] },
  { id: 'brie-cheese', name: 'Brie Cheese', calories: 95, protein: 6, carbs: 0, fat: 8, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'goat-cheese', name: 'Goat Cheese', calories: 75, protein: 5, carbs: 0, fat: 6, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
  { id: 'blue-cheese', name: 'Blue Cheese', calories: 100, protein: 6, carbs: 1, fat: 8, servingSize: '1 oz (28g)', servingGrams: 28, defaultUnit: 'oz', availableUnits: ['oz', 'g'] },
];

// Search common foods locally first, then try API
export const searchCommonFoods = (query: string): FoodItem[] => {
  const lowerQuery = query.toLowerCase();
  return commonFoods.filter(food =>
    food.name.toLowerCase().includes(lowerQuery)
  );
};
