import { FoodItem } from '../types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/cgi/search.pl';

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
        servingSize: product.serving_size || '100g'
      }));
  } catch (error) {
    console.error('Error searching foods:', error);
    return [];
  }
};

// Common foods for quick add
export const commonFoods: FoodItem[] = [
  { id: 'egg', name: 'Egg (large)', calories: 72, protein: 6, carbs: 0, fat: 5, servingSize: '1 egg' },
  { id: 'chicken-breast', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, servingSize: '100g' },
  { id: 'rice', name: 'White Rice (cooked)', calories: 130, protein: 3, carbs: 28, fat: 0, servingSize: '100g' },
  { id: 'banana', name: 'Banana (medium)', calories: 105, protein: 1, carbs: 27, fat: 0, servingSize: '1 banana' },
  { id: 'oatmeal', name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, servingSize: '1 cup' },
  { id: 'salmon', name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, servingSize: '100g' },
  { id: 'broccoli', name: 'Broccoli', calories: 55, protein: 4, carbs: 11, fat: 1, servingSize: '1 cup' },
  { id: 'apple', name: 'Apple (medium)', calories: 95, protein: 0, carbs: 25, fat: 0, servingSize: '1 apple' },
];
