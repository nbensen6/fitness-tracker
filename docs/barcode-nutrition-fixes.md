# Barcode Scanning Nutrition Fixes

## Date: December 31, 2024

## Summary
Fixed issues with barcode scanning returning incorrect calorie values for scanned products.

---

## Issue 1: Incorrect Calories (Peanut Butter)

### Problem
Scanned products showed wrong calorie values that didn't match the nutrition label.

### Root Cause
The Open Food Facts API returns nutrition data in multiple formats:
- `energy-kcal_100g` - calories per 100g (reliable)
- `energy-kcal_serving` - calories per serving
- `energy-kcal` - ambiguous (could be per-serving or per-100g)

The old code fell back to the ambiguous `energy-kcal` field when `energy-kcal_100g` was missing:
```javascript
const caloriesPer100g = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
```

This caused per-serving values to be used as per-100g values, resulting in incorrect calculations.

### Solution
Created a helper function `getNutrientPer100g()` that:
1. First tries the explicit `_100g` field
2. If missing, calculates from `_serving` field using `serving_quantity`
3. Never uses ambiguous generic fields

**File:** `services/foodApi.ts`

---

## Issue 2: Zero Calories (Oats)

### Problem
Some products (like oats) showed 0 calories after the first fix.

### Root Cause
Many products (especially European) store energy in **kilojoules (kJ)** instead of kilocalories (kcal):
- `energy-kj_100g` or `energy_100g` (in kJ)
- 1 kcal = 4.184 kJ
- Oats: ~1600 kJ/100g = ~380 kcal/100g

The code only looked for kcal fields, missing products with kJ data.

### Solution
Added fallback logic to check for kilojoules and convert:
```javascript
// If no kcal data, try kilojoules and convert
if (caloriesPer100g === 0) {
  const kjPer100g = getNutrientPer100g(nutriments, 'energy-kj_100g', 'energy-kj_serving', servingQuantity);
  if (kjPer100g > 0) {
    caloriesPer100g = kjPer100g / 4.184;
  }
}

// Last resort: try generic energy field (usually in kJ)
if (caloriesPer100g === 0) {
  const energyPer100g = getNutrientPer100g(nutriments, 'energy_100g', 'energy_serving', servingQuantity);
  if (energyPer100g > 0) {
    // If value > 400, it's likely kJ
    caloriesPer100g = energyPer100g > 400 ? energyPer100g / 4.184 : energyPer100g;
  }
}
```

**File:** `services/foodApi.ts`

---

## Data Formats Now Supported

| Field | Description | Support |
|-------|-------------|---------|
| `energy-kcal_100g` | kcal per 100g | Direct use |
| `energy-kcal_serving` | kcal per serving | Calculate per-100g using serving_quantity |
| `energy-kj_100g` | kJ per 100g | Convert to kcal (÷ 4.184) |
| `energy-kj_serving` | kJ per serving | Calculate per-100g, then convert |
| `energy_100g` | Usually kJ | Auto-detect and convert if > 400 |

---

## Other Related Fixes in This Session

1. **Default serving size**: Barcode scans now default to product's serving size instead of 1g
   - File: `app/recipes.tsx` - `handleBarcodeScan()`
   - File: `app/barcode-scanner.tsx`

2. **Recipe ingredient modal**: Fixed nested modal issue on iOS by using inline view switching
   - File: `app/recipes.tsx` - consolidated into single modal with conditional rendering

3. **Action buttons**: Moved Scan/Recipes/History buttons below meal selector on calories screen
   - File: `app/(tabs)/calories.tsx`

---

## Future Considerations

- Some products may still have incomplete data in Open Food Facts database
- Consider adding manual entry fallback when scanned data seems incorrect
- Could add validation to warn user if calculated values seem unrealistic
