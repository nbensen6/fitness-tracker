import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  View as RNView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { addCommunityFood } from '@/services/firestore';
import { FoodItem, ServingUnit } from '@/types';

interface AddFoodModalProps {
  visible: boolean;
  onClose: () => void;
  onFoodAdded: (food: FoodItem) => void;
  userId: string;
  initialBarcode?: string;
  initialName?: string;
}

export default function AddFoodModal({
  visible,
  onClose,
  onFoodAdded,
  userId,
  initialBarcode,
  initialName,
}: AddFoodModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [servingGrams, setServingGrams] = useState('100');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setBarcode(initialBarcode || '');
      setBrand('');
      setServingSize('');
      setServingGrams('100');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }
  }, [visible, initialName, initialBarcode]);

  const resetForm = () => {
    setName('');
    setBrand('');
    setBarcode('');
    setServingSize('');
    setServingGrams('100');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a food name.');
      return;
    }
    if (!calories || isNaN(parseFloat(calories))) {
      Alert.alert('Missing Calories', 'Please enter calories per serving.');
      return;
    }

    setSaving(true);

    try {
      const servGrams = parseFloat(servingGrams) || 100;
      const foodData = {
        name: brand ? `${brand} ${name.trim()}` : name.trim(),
        brand: brand.trim() || undefined,
        barcode: barcode.trim() || undefined,
        calories: Math.round(parseFloat(calories) || 0),
        protein: Math.round(parseFloat(protein) || 0),
        carbs: Math.round(parseFloat(carbs) || 0),
        fat: Math.round(parseFloat(fat) || 0),
        servingSize: servingSize.trim() || `${servGrams}g`,
        servingGrams: servGrams,
        defaultUnit: 'g' as ServingUnit,
        availableUnits: ['g', 'oz'] as ServingUnit[],
      };

      const docId = await addCommunityFood(userId, foodData);

      const newFood: FoodItem = {
        id: docId,
        ...foodData,
      };

      resetForm();
      onFoodAdded(newFood);
    } catch (error) {
      console.error('Error saving food:', error);
      Alert.alert('Error', 'Failed to save food. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <RNView style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <RNView style={styles.header}>
                <Text style={styles.title}>Add New Food</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>X</Text>
                </TouchableOpacity>
              </RNView>

              <Text style={styles.subtitle}>
                This food will be available for all users to search.
              </Text>

              {/* Form Fields */}
              <Text style={styles.label}>Food Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Honey Ham Deli Meat"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Brand (optional)</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Aldi, Appleton Farms, Bruegger's"
                placeholderTextColor="#64748b"
              />

              {initialBarcode ? (
                <>
                  <Text style={styles.label}>Barcode</Text>
                  <RNView style={[styles.input, styles.disabledInput]}>
                    <Text style={styles.disabledText}>{initialBarcode}</Text>
                  </RNView>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Barcode (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={barcode}
                    onChangeText={setBarcode}
                    placeholder="Enter barcode if known"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.sectionTitle}>Serving Information</Text>

              <Text style={styles.label}>Serving Size Description</Text>
              <TextInput
                style={styles.input}
                value={servingSize}
                onChangeText={setServingSize}
                placeholder="e.g., 2 oz (56g), 1 slice, 1 bagel"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Serving Size in Grams *</Text>
              <TextInput
                style={styles.input}
                value={servingGrams}
                onChangeText={setServingGrams}
                placeholder="100"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
              <Text style={styles.hint}>Find this info on the nutrition label</Text>

              <RNView style={styles.nutritionRow}>
                <RNView style={styles.nutritionField}>
                  <Text style={styles.label}>Calories *</Text>
                  <TextInput
                    style={styles.input}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </RNView>
                <RNView style={styles.nutritionField}>
                  <Text style={styles.label}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </RNView>
              </RNView>

              <RNView style={styles.nutritionRow}>
                <RNView style={styles.nutritionField}>
                  <Text style={styles.label}>Carbs (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </RNView>
                <RNView style={styles.nutritionField}>
                  <Text style={styles.label}>Fat (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={fat}
                    onChangeText={setFat}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </RNView>
              </RNView>

              {/* Action Buttons */}
              <RNView style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                  <LinearGradient
                    colors={['#4ade80', '#22c55e']}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Saving...' : 'Save Food'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </RNView>
            </ScrollView>
          </RNView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  disabledInput: {
    opacity: 0.7,
  },
  disabledText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nutritionField: {
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 140,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
