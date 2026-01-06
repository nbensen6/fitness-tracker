import React, { useState, useEffect } from 'react';
import { StyleSheet, View as RNView, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text } from '@/components/Themed';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lookupBarcode, convertToGrams, calculateNutrition } from '@/services/foodApi';
import { addMealEntry } from '@/services/firestore';
import { useAuth } from '@/hooks/useAuth';
import { FoodItem, ServingUnit } from '@/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function BarcodeScannerScreen() {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const mealType = (params.mealType as MealType) || 'snack';

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedFood, setScannedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState<ServingUnit>('g');

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

    try {
      const food = await lookupBarcode(data);

      if (food) {
        setScannedFood(food);
        // Default based on food type
        if (food.defaultUnit === 'piece' && food.gramsPerCup) {
          // For piece-based foods, default to 1 piece
          setQuantity('1');
          setSelectedUnit('piece');
        } else {
          // For other foods, default to serving quantity or 100g
          const defaultServingGrams = food.gramsPerCup || 100;
          setQuantity(defaultServingGrams.toString());
          setSelectedUnit('g');
        }
      } else {
        Alert.alert(
          'Product Not Found',
          'This barcode was not found in the database. Try searching for the food manually.',
          [
            { text: 'Scan Again', onPress: () => setScanned(false) },
            { text: 'Go Back', onPress: () => router.back() },
          ]
        );
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      Alert.alert('Error', 'Failed to look up product. Please try again.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const addToLog = async () => {
    if (!userId || !scannedFood) return;

    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    const gramsConsumed = convertToGrams(qty, selectedUnit, scannedFood);
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    try {
      await addMealEntry(userId, {
        foodItem: scannedFood,
        quantity: qty,
        unit: selectedUnit,
        gramsConsumed,
        mealType,
        date: today,
      });
      router.back();
    } catch (error) {
      console.error('Error adding food:', error);
      Alert.alert('Error', 'Failed to add food to log');
    }
  };

  const getPreviewNutrition = () => {
    if (!scannedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const qty = parseFloat(quantity) || 0;
    const gramsConsumed = convertToGrams(qty, selectedUnit, scannedFood);
    return calculateNutrition(scannedFood, gramsConsumed);
  };

  if (!permission) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={[styles.centerContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#e94560" />
        </RNView>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={[styles.centerContainer, { paddingTop: insets.top }]}>
          <Text style={styles.permissionText}>Camera permission is required to scan barcodes</Text>
          <TouchableOpacity onPress={requestPermission}>
            <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </RNView>
      </LinearGradient>
    );
  }

  // Show scanned food result
  if (scannedFood) {
    const preview = getPreviewNutrition();

    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <RNView style={[styles.resultContainer, { paddingTop: insets.top }]}>
            {/* Header */}
            <RNView style={styles.header}>
              <TouchableOpacity onPress={() => {
                Keyboard.dismiss();
                setScannedFood(null);
                setScanned(false);
              }} style={styles.backButton}>
                <Text style={styles.backArrow}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Product Found</Text>
              <RNView style={styles.headerSpacer} />
            </RNView>

            {/* Food Info */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.foodCard}>
              <Text style={styles.foodName}>{scannedFood.name}</Text>
              <Text style={styles.foodServing}>Serving: {scannedFood.servingSize}</Text>

              <RNView style={styles.nutritionRow}>
                <RNView style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scannedFood.calories}</Text>
                  <Text style={styles.nutritionLabel}>cal/100g</Text>
                </RNView>
                <RNView style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scannedFood.protein}g</Text>
                  <Text style={styles.nutritionLabel}>protein</Text>
                </RNView>
                <RNView style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scannedFood.carbs}g</Text>
                  <Text style={styles.nutritionLabel}>carbs</Text>
                </RNView>
                <RNView style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scannedFood.fat}g</Text>
                  <Text style={styles.nutritionLabel}>fat</Text>
                </RNView>
              </RNView>
            </LinearGradient>

            {/* Amount Input */}
            <Text style={styles.inputLabel}>Amount</Text>
            <RNView style={styles.quantityInputRow}>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="Amount"
                placeholderTextColor="#64748b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <RNView style={styles.unitSelector}>
                {(scannedFood?.availableUnits || ['g', 'oz']).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.unitButton, selectedUnit === unit && styles.unitButtonActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedUnit(unit);
                    }}
                  >
                    <Text style={[styles.unitButtonText, selectedUnit === unit && styles.unitButtonTextActive]}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </RNView>
            </RNView>

            {/* Quick Amount Buttons */}
            <RNView style={styles.amountRow}>
              {scannedFood?.defaultUnit === 'piece' ? (
                // Piece-based quick amounts
                ['1', '2', '4', '6'].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.amountButton, quantity === amt && selectedUnit === 'piece' && styles.amountButtonActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setQuantity(amt);
                      setSelectedUnit('piece');
                    }}
                  >
                    <Text style={[styles.amountButtonText, quantity === amt && selectedUnit === 'piece' && styles.amountButtonTextActive]}>
                      {amt} pc
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                // Gram-based quick amounts
                [
                  scannedFood?.gramsPerCup ? Math.round(scannedFood.gramsPerCup).toString() : '30',
                  '50',
                  '100',
                  '150'
                ].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.amountButton, quantity === amt && selectedUnit === 'g' && styles.amountButtonActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setQuantity(amt);
                      setSelectedUnit('g');
                    }}
                  >
                    <Text style={[styles.amountButtonText, quantity === amt && selectedUnit === 'g' && styles.amountButtonTextActive]}>
                      {amt}g
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </RNView>

            {/* Preview */}
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.previewCard}>
              <Text style={styles.previewTitle}>Adding to {mealType}</Text>
              <RNView style={styles.previewRow}>
                <RNView style={styles.previewItem}>
                  <Text style={styles.previewValue}>{preview.calories}</Text>
                  <Text style={styles.previewLabel}>cal</Text>
                </RNView>
                <RNView style={styles.previewItem}>
                  <Text style={styles.previewValue}>{preview.protein}g</Text>
                  <Text style={styles.previewLabel}>protein</Text>
                </RNView>
                <RNView style={styles.previewItem}>
                  <Text style={styles.previewValue}>{preview.carbs}g</Text>
                  <Text style={styles.previewLabel}>carbs</Text>
                </RNView>
                <RNView style={styles.previewItem}>
                  <Text style={styles.previewValue}>{preview.fat}g</Text>
                  <Text style={styles.previewLabel}>fat</Text>
                </RNView>
              </RNView>
            </LinearGradient>

            {/* Action Buttons */}
            <RNView style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addToLog}>
                <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.addButton}>
                  <Text style={styles.addButtonText}>Add to Log</Text>
                </LinearGradient>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </TouchableWithoutFeedback>
      </LinearGradient>
    );
  }

  // Camera/Scanner View
  return (
    <RNView style={styles.scannerContainer}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
      >
        {/* Overlay */}
        <RNView style={[styles.overlay, { paddingTop: insets.top }]}>
          {/* Header */}
          <RNView style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan Barcode</Text>
            <RNView style={styles.headerSpacer} />
          </RNView>

          {/* Scanner Frame */}
          <RNView style={styles.scannerFrameContainer}>
            <RNView style={styles.scannerFrame}>
              <RNView style={[styles.corner, styles.topLeft]} />
              <RNView style={[styles.corner, styles.topRight]} />
              <RNView style={[styles.corner, styles.bottomLeft]} />
              <RNView style={[styles.corner, styles.bottomRight]} />
            </RNView>
            {loading && (
              <RNView style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Looking up product...</Text>
              </RNView>
            )}
          </RNView>

          {/* Instructions */}
          <RNView style={styles.instructions}>
            <Text style={styles.instructionText}>
              Point camera at a barcode to scan
            </Text>
            <Text style={styles.mealTypeText}>
              Adding to: {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </Text>
          </RNView>
        </RNView>
      </CameraView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  backLink: {
    marginTop: 20,
    padding: 10,
  },
  backLinkText: {
    color: '#64748b',
    fontSize: 14,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  scannerFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 280,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4ade80',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  instructions: {
    padding: 30,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  mealTypeText: {
    fontSize: 14,
    color: '#4ade80',
    marginTop: 8,
  },
  // Result Screen Styles
  resultContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  foodCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  foodName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  foodServing: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ade80',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    fontWeight: '500',
  },
  quantityInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  unitButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#374151',
  },
  unitButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  unitButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  amountButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  amountButtonActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  amountButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 12,
  },
  amountButtonTextActive: {
    color: '#fff',
  },
  previewCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#4ade80',
  },
  previewLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 140,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
