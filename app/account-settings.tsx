import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  View as RNView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile } from '@/services/firestore';
import { calculateCaloriesForUser, calculateSuggestedMacros, getActivityLevelDescription } from '@/services/calorieCalculator';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'very_active', label: 'Very Active' },
] as const;

export default function AccountSettingsScreen() {
  const { userId, userProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState('');

  // Image cropping state (for web)
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [activityLevel, setActivityLevel] = useState<string>('moderate');
  const [goalWeight, setGoalWeight] = useState('');
  const [goalWeeks, setGoalWeeks] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [carbsGoal, setCarbsGoal] = useState('');
  const [fatGoal, setFatGoal] = useState('');

  const [saving, setSaving] = useState(false);
  const [calorieRecommendation, setCalorieRecommendation] = useState<number | null>(null);

  // Load existing profile data
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setProfilePicture(userProfile.profilePicture || null);
      setCurrentWeight(userProfile.currentWeight?.toString() || '');
      setHeightFeet(userProfile.heightFeet?.toString() || '');
      setHeightInches(userProfile.heightInches?.toString() || '');
      setAge(userProfile.age?.toString() || '');
      setGender(userProfile.gender || null);
      setActivityLevel(userProfile.activityLevel || 'moderate');
      setGoalWeight(userProfile.goalWeight?.toString() || '');
      setGoalWeeks(userProfile.goalWeeks?.toString() || '');
      setProteinGoal(userProfile.proteinGoal?.toString() || '');
      setCarbsGoal(userProfile.carbsGoal?.toString() || '');
      setFatGoal(userProfile.fatGoal?.toString() || '');
    }
  }, [userProfile]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (): Promise<string | null> => {
    if (!imageToCrop || !croppedAreaPixels) return null;

    return new Promise((resolve) => {
      const image = new window.Image();
      image.src = imageToCrop;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Set canvas size to desired output size
        const outputSize = 200;
        canvas.width = outputSize;
        canvas.height = outputSize;

        // Draw the cropped portion
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          outputSize,
          outputSize
        );

        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };
    });
  };

  const handleCropConfirm = async () => {
    const croppedImage = await createCroppedImage();
    if (croppedImage) {
      setProfilePicture(croppedImage);
    }
    setShowCropper(false);
    setImageToCrop(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS !== 'web', // Only use native editing on mobile
      aspect: [1, 1],
      quality: 0.8,
      base64: Platform.OS !== 'web', // Only need base64 on mobile
    });

    if (!result.canceled && result.assets[0]) {
      if (Platform.OS === 'web') {
        // On web, show the cropper modal
        setImageToCrop(result.assets[0].uri);
        setShowCropper(true);
      } else if (result.assets[0].base64) {
        // On mobile, use the already-cropped image
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfilePicture(base64Image);
      }
    }
  };

  // Calculate calorie recommendation when relevant fields change
  useEffect(() => {
    if (currentWeight && heightFeet && age && gender && activityLevel) {
      const profile = {
        uid: userId || '',
        email: '',
        displayName: '',
        calorieGoal: 2000,
        createdAt: new Date(),
        currentWeight: parseFloat(currentWeight),
        heightFeet: parseInt(heightFeet),
        heightInches: parseInt(heightInches) || 0,
        age: parseInt(age),
        gender: gender as 'male' | 'female',
        activityLevel: activityLevel as any,
        goalWeight: goalWeight ? parseFloat(goalWeight) : undefined,
        goalWeeks: goalWeeks ? parseInt(goalWeeks) : undefined,
      };

      const calc = calculateCaloriesForUser(profile);
      if (calc) {
        setCalorieRecommendation(calc.targetCalories);
      }
    }
  }, [currentWeight, heightFeet, heightInches, age, gender, activityLevel, goalWeight, goalWeeks]);

  const handleSuggestMacros = () => {
    if (!calorieRecommendation || !currentWeight) return;

    const weight = parseFloat(currentWeight);
    const goal = parseFloat(goalWeight || currentWeight);
    const goalType = goal < weight ? 'lose' : goal > weight ? 'gain' : 'maintain';

    const macros = calculateSuggestedMacros(calorieRecommendation, weight, goalType);
    setProteinGoal(macros.protein.toString());
    setCarbsGoal(macros.carbs.toString());
    setFatGoal(macros.fat.toString());
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const updates: any = {
        displayName,
        updatedAt: new Date(),
      };

      if (profilePicture) updates.profilePicture = profilePicture;
      if (currentWeight) updates.currentWeight = parseFloat(currentWeight);
      if (heightFeet) updates.heightFeet = parseInt(heightFeet);
      if (heightInches) updates.heightInches = parseInt(heightInches);
      if (age) updates.age = parseInt(age);
      if (gender) updates.gender = gender;
      if (activityLevel) updates.activityLevel = activityLevel;
      if (goalWeight) updates.goalWeight = parseFloat(goalWeight);
      if (goalWeeks) updates.goalWeeks = parseInt(goalWeeks);
      if (proteinGoal) updates.proteinGoal = parseInt(proteinGoal);
      if (carbsGoal) updates.carbsGoal = parseInt(carbsGoal);
      if (fatGoal) updates.fatGoal = parseInt(fatGoal);

      // Set calorie goal
      if (calorieRecommendation) {
        updates.calorieGoal = calorieRecommendation;
      }

      // Determine goal type
      if (goalWeight && currentWeight) {
        const cw = parseFloat(currentWeight);
        const gw = parseFloat(goalWeight);
        updates.goalType = gw < cw ? 'lose' : gw > cw ? 'gain' : 'maintain';
      }

      await updateUserProfile(userId, updates);
      await refreshProfile();
      Alert.alert('Success', 'Your settings have been saved!');
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: insets.top }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <RNView style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Account Settings</Text>
          </RNView>

          {/* Profile Section */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>

            {/* Profile Picture */}
            <RNView style={styles.profilePictureContainer}>
              <TouchableOpacity onPress={pickImage} style={styles.profilePictureButton}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
                ) : (
                  <RNView style={styles.profilePicturePlaceholder}>
                    <Text style={styles.profilePictureInitial}>
                      {displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </RNView>
                )}
                <RNView style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>Edit</Text>
                </RNView>
              </TouchableOpacity>
              <Text style={styles.profilePictureHint}>Tap to change profile picture</Text>
            </RNView>

            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#64748b"
            />
          </LinearGradient>

          {/* Body Stats Section */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
            <Text style={styles.sectionTitle}>Body Stats</Text>

            <Text style={styles.label}>Current Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={currentWeight}
              onChangeText={setCurrentWeight}
              placeholder="e.g. 180"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Height</Text>
            <RNView style={styles.row}>
              <RNView style={styles.halfInput}>
                <TextInput
                  style={styles.input}
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                  placeholder="Feet"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </RNView>
              <RNView style={styles.halfInput}>
                <TextInput
                  style={styles.input}
                  value={heightInches}
                  onChangeText={setHeightInches}
                  placeholder="Inches"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </RNView>
            </RNView>

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="e.g. 25"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Gender</Text>
            <RNView style={styles.row}>
              <TouchableOpacity
                style={[styles.optionButton, gender === 'male' && styles.optionSelected]}
                onPress={() => setGender('male')}
              >
                <Text style={[styles.optionText, gender === 'male' && styles.optionTextSelected]}>
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, gender === 'female' && styles.optionSelected]}
                onPress={() => setGender('female')}
              >
                <Text style={[styles.optionText, gender === 'female' && styles.optionTextSelected]}>
                  Female
                </Text>
              </TouchableOpacity>
            </RNView>

            <Text style={styles.label}>Activity Level</Text>
            <RNView style={styles.activityContainer}>
              {ACTIVITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.activityButton,
                    activityLevel === level.key && styles.activitySelected,
                  ]}
                  onPress={() => setActivityLevel(level.key)}
                >
                  <Text
                    style={[
                      styles.activityText,
                      activityLevel === level.key && styles.activityTextSelected,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
            <Text style={styles.helperText}>
              {getActivityLevelDescription(activityLevel)}
            </Text>
          </LinearGradient>

          {/* Goals Section */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
            <Text style={styles.sectionTitle}>Goals</Text>

            <Text style={styles.label}>Goal Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={goalWeight}
              onChangeText={setGoalWeight}
              placeholder="e.g. 165"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Weeks to Reach Goal</Text>
            <TextInput
              style={styles.input}
              value={goalWeeks}
              onChangeText={setGoalWeeks}
              placeholder="e.g. 12"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            {calorieRecommendation && (
              <RNView style={styles.recommendation}>
                <Text style={styles.recommendationLabel}>Recommended Daily Calories</Text>
                <Text style={styles.recommendationValue}>{calorieRecommendation}</Text>
                <Text style={styles.recommendationNote}>
                  Based on your stats and goals
                </Text>
              </RNView>
            )}
          </LinearGradient>

          {/* Macros Section */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
            <RNView style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Macros (Optional)</Text>
              <TouchableOpacity onPress={handleSuggestMacros} style={styles.suggestButton}>
                <Text style={styles.suggestText}>Auto-fill</Text>
              </TouchableOpacity>
            </RNView>

            <RNView style={styles.row}>
              <RNView style={styles.macroInput}>
                <Text style={styles.macroLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  value={proteinGoal}
                  onChangeText={setProteinGoal}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </RNView>
              <RNView style={styles.macroInput}>
                <Text style={styles.macroLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  value={carbsGoal}
                  onChangeText={setCarbsGoal}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </RNView>
              <RNView style={styles.macroInput}>
                <Text style={styles.macroLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  value={fatGoal}
                  onChangeText={setFatGoal}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </RNView>
            </RNView>
          </LinearGradient>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.saveGradient}>
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <RNView style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image Cropper Modal (Web only) */}
      {Platform.OS === 'web' && (
        <Modal visible={showCropper} transparent animationType="fade">
          <RNView style={styles.cropperOverlay}>
            <RNView style={styles.cropperContainer}>
              <Text style={styles.cropperTitle}>Position Your Photo</Text>
              <Text style={styles.cropperSubtitle}>Drag to move, scroll to zoom</Text>

              <RNView style={styles.cropperArea}>
                {imageToCrop && (
                  <Cropper
                    image={imageToCrop}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                )}
              </RNView>

              <RNView style={styles.zoomControl}>
                <Text style={styles.zoomLabel}>Zoom</Text>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#e94560' }}
                />
              </RNView>

              <RNView style={styles.cropperButtons}>
                <TouchableOpacity style={styles.cropperCancelButton} onPress={handleCropCancel}>
                  <Text style={styles.cropperCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCropConfirm}>
                  <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.cropperConfirmButton}>
                    <Text style={styles.cropperConfirmText}>Confirm</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </RNView>
            </RNView>
          </RNView>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: '#e94560',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePictureButton: {
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e94560',
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e94560',
  },
  profilePictureInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  profilePictureHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  optionSelected: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  optionText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  activityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityButton: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  activitySelected: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  activityText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  activityTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  recommendation: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  recommendationLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  recommendationValue: {
    color: '#4ade80',
    fontSize: 32,
    fontWeight: '700',
    marginVertical: 4,
  },
  recommendationNote: {
    color: '#64748b',
    fontSize: 12,
  },
  macroInput: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'center',
  },
  suggestButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  suggestText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  // Cropper modal styles
  cropperOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropperContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  cropperTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cropperSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  cropperArea: {
    width: 280,
    height: 280,
    position: 'relative',
    borderRadius: 140,
    overflow: 'hidden',
  },
  zoomControl: {
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  zoomLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  cropperButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  cropperCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cropperCancelText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  cropperConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cropperConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
