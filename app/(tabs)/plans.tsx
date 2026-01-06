import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View as RNView, ImageBackground, Linking, Platform, useWindowDimensions, Modal, TextInput } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { setUserWorkoutPlan, getUserWorkoutPlan, updateUserWorkoutPlan, saveCustomPlan, getUserCustomPlans, deleteCustomPlan, deleteUserWorkoutPlan } from '@/services/firestore';
import { WorkoutPlan, UserWorkoutPlan, WorkoutDay, PlanExercise } from '@/types';
import { getAllWorkoutPlans, getWorkoutPlansByDifficulty, EXERCISES } from '@/services/workoutDatabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

export default function PlansScreen() {
  const { userId, isSignedIn } = useAuth();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const containerMaxWidth = isWeb && width > 768 ? '50%' : '100%';
  const [activePlan, setActivePlan] = useState<UserWorkoutPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DifficultyFilter>('all');
  const [customPlans, setCustomPlans] = useState<WorkoutPlan[]>([]);

  // Custom plan creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customPlanName, setCustomPlanName] = useState('');
  const [customPlanDays, setCustomPlanDays] = useState<WorkoutDay[]>([]);
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'];

  const workoutPlans = filter === 'all'
    ? getAllWorkoutPlans()
    : getWorkoutPlansByDifficulty(filter);

  // Filter exercises based on search and category
  const filteredExercises = EXERCISES.filter(ex => {
    const matchesSearch = exerciseSearch.trim() === '' ||
      ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (userId) {
      loadActivePlan();
      loadCustomPlans();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadActivePlan = async () => {
    if (!userId) return;
    try {
      const plan = await getUserWorkoutPlan(userId);
      setActivePlan(plan);
    } catch (error) {
      console.error('Error loading plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomPlans = async () => {
    if (!userId) return;
    try {
      const plans = await getUserCustomPlans(userId);
      setCustomPlans(plans.map(p => p.plan as WorkoutPlan));
    } catch (error) {
      console.error('Error loading custom plans:', error);
    }
  };

  const startPlan = async (plan: WorkoutPlan) => {
    if (!userId) {
      Alert.alert('Please sign in', 'You need to sign in to start a plan.');
      return;
    }

    try {
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      await setUserWorkoutPlan(userId, {
        planId: plan.id,
        plan,
        startDate: today,
        currentDay: 1,
        completedDays: [],
      });
      loadActivePlan();
      setSelectedPlan(null);
      Alert.alert('Plan Started', `You've started the ${plan.name} plan!`);
    } catch (error) {
      console.error('Error starting plan:', error);
      Alert.alert('Error', 'Failed to start plan');
    }
  };

  const changeDay = async (dayNumber: number) => {
    if (!activePlan) return;

    try {
      await updateUserWorkoutPlan(activePlan.id, {
        currentDay: dayNumber,
      });

      setActivePlan({
        ...activePlan,
        currentDay: dayNumber,
      });
    } catch (error) {
      console.error('Error changing day:', error);
    }
  };

  const startWorkout = () => {
    if (!activePlan) return;

    const currentDayPlan = activePlan.plan.days.find(
      (d) => d.dayNumber === activePlan.currentDay
    );

    if (!currentDayPlan || currentDayPlan.isRestDay) return;

    // Navigate to workouts tab with plan data
    router.push({
      pathname: '/(tabs)/workouts',
      params: {
        fromPlan: 'true',
        planId: activePlan.planId,
        dayNumber: activePlan.currentDay.toString(),
        workoutName: currentDayPlan.name,
        exercises: JSON.stringify(currentDayPlan.exercises.map(ex => ({
          exerciseId: ex.exercise.id,
          exerciseName: ex.exercise.name,
          category: ex.exercise.category,
          equipment: ex.exercise.equipment,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
        }))),
      },
    });
  };

  const markDayComplete = async () => {
    if (!activePlan) return;

    try {
      const newCompletedDays = activePlan.completedDays.includes(activePlan.currentDay)
        ? activePlan.completedDays
        : [...activePlan.completedDays, activePlan.currentDay];
      const nextDay = activePlan.currentDay >= activePlan.plan.days.length ? 1 : activePlan.currentDay + 1;

      await updateUserWorkoutPlan(activePlan.id, {
        completedDays: newCompletedDays,
        currentDay: nextDay,
      });

      setActivePlan({
        ...activePlan,
        completedDays: newCompletedDays,
        currentDay: nextDay,
      });
    } catch (error) {
      console.error('Error completing day:', error);
    }
  };

  const cancelPlan = () => {
    Alert.alert('Cancel Plan', 'Are you sure you want to stop this plan?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          if (activePlan?.id) {
            await deleteUserWorkoutPlan(activePlan.id);
          }
          setActivePlan(null);
        },
      },
    ]);
  };

  // Custom plan creation functions
  const startCreateCustomPlan = () => {
    setCustomPlanName('');
    setCustomPlanDays([
      { dayNumber: 1, name: 'Day 1', exercises: [], isRestDay: false },
    ]);
    setEditingDayIndex(null);
    setShowCreateModal(true);
  };

  const addDay = () => {
    const newDayNumber = customPlanDays.length + 1;
    setCustomPlanDays([
      ...customPlanDays,
      { dayNumber: newDayNumber, name: `Day ${newDayNumber}`, exercises: [], isRestDay: false },
    ]);
  };

  const removeDay = (index: number) => {
    if (customPlanDays.length <= 1) return;
    const newDays = customPlanDays.filter((_, i) => i !== index);
    // Renumber days
    newDays.forEach((day, i) => {
      day.dayNumber = i + 1;
      if (day.name.startsWith('Day ')) {
        day.name = `Day ${i + 1}`;
      }
    });
    setCustomPlanDays(newDays);
    if (editingDayIndex === index) {
      setEditingDayIndex(null);
    }
  };

  const toggleRestDay = (index: number) => {
    const newDays = [...customPlanDays];
    newDays[index].isRestDay = !newDays[index].isRestDay;
    if (newDays[index].isRestDay) {
      newDays[index].exercises = [];
      newDays[index].name = 'Rest Day';
    } else {
      newDays[index].name = `Day ${index + 1}`;
    }
    setCustomPlanDays(newDays);
  };

  const updateDayName = (index: number, name: string) => {
    const newDays = [...customPlanDays];
    newDays[index].name = name;
    setCustomPlanDays(newDays);
  };

  const addExerciseToDay = (exercise: any) => {
    if (editingDayIndex === null) return;
    const newDays = [...customPlanDays];
    newDays[editingDayIndex].exercises.push({
      exercise,
      targetSets: 3,
      targetReps: 10,
    });
    setCustomPlanDays(newDays);
    setShowExerciseList(false);
    setExerciseSearch('');
  };

  const removeExerciseFromDay = (dayIndex: number, exerciseIndex: number) => {
    const newDays = [...customPlanDays];
    newDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setCustomPlanDays(newDays);
  };

  const updateExerciseSets = (dayIndex: number, exerciseIndex: number, sets: number) => {
    const newDays = [...customPlanDays];
    newDays[dayIndex].exercises[exerciseIndex].targetSets = sets;
    setCustomPlanDays(newDays);
  };

  const updateExerciseReps = (dayIndex: number, exerciseIndex: number, reps: number) => {
    const newDays = [...customPlanDays];
    newDays[dayIndex].exercises[exerciseIndex].targetReps = reps;
    setCustomPlanDays(newDays);
  };

  const saveCustomPlanHandler = async () => {
    if (!userId) return;
    if (!customPlanName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }
    if (customPlanDays.length === 0) {
      Alert.alert('Error', 'Please add at least one day');
      return;
    }

    const plan: WorkoutPlan = {
      id: `custom-${Date.now()}`,
      name: customPlanName,
      description: 'Custom plan',
      difficulty: 'intermediate',
      daysPerWeek: customPlanDays.filter(d => !d.isRestDay).length,
      days: customPlanDays,
    };

    try {
      await saveCustomPlan(userId, { plan });
      setShowCreateModal(false);
      loadCustomPlans();
      Alert.alert('Success', 'Custom plan saved!');
    } catch (error) {
      console.error('Error saving custom plan:', error);
      Alert.alert('Error', 'Failed to save plan');
    }
  };

  const openYouTubeSearch = (exerciseName: string) => {
    const searchQuery = encodeURIComponent(`${exerciseName} exercise how to`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${searchQuery}`);
  };

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={styles.messageContainer}>
          <Text style={styles.message}>Please sign in to access workout plans</Text>
        </RNView>
      </LinearGradient>
    );
  }

  // Show active plan
  if (activePlan && !selectedPlan) {
    const currentDayPlan = activePlan.plan.days.find(
      (d) => d.dayNumber === activePlan.currentDay
    );

    return (
      <ImageBackground
        source={require('@/assets/images/nbensen6_close-up_of_steel_dumbbells_on_a_rack_shallow_depth__1838cc81-ad8e-4843-8f49-5d83cbdea52d_0.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <RNView style={styles.overlay}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <RNView style={[styles.container, { maxWidth: containerMaxWidth }]}>
              <RNView style={styles.activePlanHeader}>
                <Text style={styles.activePlanName}>{activePlan.plan.name}</Text>
                <RNView style={styles.dayNavigator}>
                  <TouchableOpacity
                    style={styles.dayNavButton}
                    onPress={() => changeDay(Math.max(1, activePlan.currentDay - 1))}
                    disabled={activePlan.currentDay <= 1}
                  >
                    <Text style={[styles.dayNavText, activePlan.currentDay <= 1 && styles.dayNavDisabled]}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.activePlanProgress}>
                    Day {activePlan.currentDay} of {activePlan.plan.days.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.dayNavButton}
                    onPress={() => changeDay(Math.min(activePlan.plan.days.length, activePlan.currentDay + 1))}
                    disabled={activePlan.currentDay >= activePlan.plan.days.length}
                  >
                    <Text style={[styles.dayNavText, activePlan.currentDay >= activePlan.plan.days.length && styles.dayNavDisabled]}>›</Text>
                  </TouchableOpacity>
                </RNView>
              </RNView>

              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.todayCard}>
                <Text style={styles.todayTitle}>Today's Workout</Text>
                <Text style={styles.todayName}>{currentDayPlan?.name}</Text>

                {currentDayPlan?.isRestDay ? (
                  <RNView style={styles.restDay}>
                    <Text style={styles.restDayText}>Rest Day</Text>
                    <Text style={styles.restDaySubtext}>
                      Recovery is important! Take it easy today.
                    </Text>
                  </RNView>
                ) : (
                  <>
                    {currentDayPlan?.exercises.map((ex, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.exerciseItem}
                        onPress={() => openYouTubeSearch(ex.exercise.name)}
                      >
                        <RNView style={styles.exerciseItemLeft}>
                          <Text style={styles.exerciseItemName}>{ex.exercise.name}</Text>
                          <Text style={styles.exerciseItemSets}>
                            {ex.targetSets} x {ex.targetReps}
                          </Text>
                        </RNView>
                        <RNView style={styles.videoIcon}>
                          <Text style={styles.videoIconText}>▶</Text>
                        </RNView>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {currentDayPlan?.isRestDay ? (
                  <TouchableOpacity style={styles.completeButton} onPress={markDayComplete}>
                    <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.completeGradient}>
                      <Text style={styles.completeButtonText}>Skip to Next Day</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.completeButton} onPress={startWorkout}>
                    <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.completeGradient}>
                      <Text style={styles.completeButtonText}>Start Workout</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </LinearGradient>

              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.weekOverview}>
                <RNView style={styles.weekHeader}>
                  <Text style={styles.weekTitle}>Week Overview</Text>
                  <Text style={styles.weekHint}>Tap to jump to day</Text>
                </RNView>
                <RNView style={styles.weekDays}>
                  {activePlan.plan.days.map((day) => (
                    <TouchableOpacity
                      key={day.dayNumber}
                      style={[
                        styles.weekDay,
                        activePlan.completedDays.includes(day.dayNumber) && styles.weekDayCompleted,
                        day.dayNumber === activePlan.currentDay && styles.weekDayCurrent,
                      ]}
                      onPress={() => changeDay(day.dayNumber)}
                    >
                      <Text
                        style={[
                          styles.weekDayText,
                          activePlan.completedDays.includes(day.dayNumber) && styles.weekDayTextCompleted,
                          day.dayNumber === activePlan.currentDay && styles.weekDayTextCurrent,
                        ]}
                      >
                        {day.dayNumber}
                      </Text>
                      {day.isRestDay && <Text style={styles.weekDayRest}>R</Text>}
                    </TouchableOpacity>
                  ))}
                </RNView>
              </LinearGradient>

              <TouchableOpacity style={styles.cancelPlanButton} onPress={cancelPlan}>
                <Text style={styles.cancelPlanText}>Cancel Plan</Text>
              </TouchableOpacity>
            </RNView>
          </ScrollView>
        </RNView>
      </ImageBackground>
    );
  }

  // Show plan selection
  return (
    <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <RNView style={[styles.container, { maxWidth: containerMaxWidth }]}>
          <Text style={styles.title}>Workout Plans</Text>
          <Text style={styles.subtitle}>
            Select a plan that fits your schedule and goals
          </Text>

          {/* Filter tabs */}
          <RNView style={styles.filterContainer}>
            {(['all', 'beginner', 'intermediate', 'advanced'] as DifficultyFilter[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.filterTab, filter === level && styles.filterTabActive]}
                onPress={() => setFilter(level)}
              >
                <Text style={[styles.filterText, filter === level && styles.filterTextActive]}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </RNView>

          {/* Create Custom Plan Button */}
          <TouchableOpacity onPress={startCreateCustomPlan}>
            <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.createCustomButton}>
              <Text style={styles.createCustomText}>+ Create Custom Plan</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Custom Plans Section */}
          {customPlans.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>My Custom Plans</Text>
              {customPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => setSelectedPlan(plan)}
                >
                  <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.planCard}>
                    <RNView style={styles.planHeader}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <RNView style={[styles.difficultyBadge, { backgroundColor: '#9333ea' }]}>
                        <Text style={styles.difficultyText}>Custom</Text>
                      </RNView>
                    </RNView>
                    <Text style={styles.planDescription}>{plan.description}</Text>
                    <Text style={styles.planDays}>{plan.daysPerWeek} days per week</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Pre-made Plans Section */}
          <Text style={styles.sectionTitle}>Pre-made Plans</Text>

          {workoutPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan)}
            >
              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.planCard}>
                <RNView style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <RNView style={[styles.difficultyBadge, styles[`difficulty_${plan.difficulty}`]]}>
                    <Text style={styles.difficultyText}>{plan.difficulty}</Text>
                  </RNView>
                </RNView>
                <Text style={styles.planDescription}>{plan.description}</Text>
                <Text style={styles.planDays}>{plan.daysPerWeek} days per week</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {/* Plan Details Modal */}
          {selectedPlan && (
            <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.planDetailsModal}>
              <Text style={styles.modalTitle}>{selectedPlan.name}</Text>
              <Text style={styles.modalDescription}>{selectedPlan.description}</Text>

              <Text style={styles.scheduleTitle}>Weekly Schedule</Text>
              {selectedPlan.days.map((day) => (
                <RNView key={day.dayNumber} style={styles.scheduleDay}>
                  <Text style={styles.scheduleDayNumber}>Day {day.dayNumber}</Text>
                  <Text style={styles.scheduleDayName}>
                    {day.isRestDay ? 'Rest' : day.name}
                  </Text>
                </RNView>
              ))}

              <RNView style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setSelectedPlan(null)}
                >
                  <Text style={styles.modalCancelText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalStartButton}
                  onPress={() => startPlan(selectedPlan)}
                >
                  <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.startGradient}>
                    <Text style={styles.modalStartText}>Start Plan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </RNView>
            </LinearGradient>
          )}

          {/* Custom Plan Creation Modal */}
          <Modal visible={showCreateModal} animationType="slide" transparent>
            <RNView style={styles.modalOverlay}>
              <RNView style={styles.customPlanModal}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.customModalTitle}>Create Custom Plan</Text>

                  {/* Plan Name */}
                  <Text style={styles.inputLabel}>Plan Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customPlanName}
                    onChangeText={setCustomPlanName}
                    placeholder="My Workout Plan"
                    placeholderTextColor="#64748b"
                  />

                  {/* Days */}
                  <RNView style={styles.daysHeader}>
                    <Text style={styles.inputLabel}>Days</Text>
                    <TouchableOpacity onPress={addDay} style={styles.addDayButton}>
                      <Text style={styles.addDayText}>+ Add Day</Text>
                    </TouchableOpacity>
                  </RNView>

                  {customPlanDays.map((day, dayIndex) => (
                    <LinearGradient key={dayIndex} colors={['#2d2d44', '#1f1f2e']} style={styles.dayCard}>
                      <RNView style={styles.dayHeader}>
                        <TextInput
                          style={styles.dayNameInput}
                          value={day.name}
                          onChangeText={(text) => updateDayName(dayIndex, text)}
                          placeholder={`Day ${dayIndex + 1}`}
                          placeholderTextColor="#64748b"
                        />
                        <RNView style={styles.dayActions}>
                          <TouchableOpacity
                            style={[styles.restToggle, day.isRestDay && styles.restToggleActive]}
                            onPress={() => toggleRestDay(dayIndex)}
                          >
                            <Text style={[styles.restToggleText, day.isRestDay && styles.restToggleTextActive]}>
                              Rest
                            </Text>
                          </TouchableOpacity>
                          {customPlanDays.length > 1 && (
                            <TouchableOpacity onPress={() => removeDay(dayIndex)}>
                              <Text style={styles.removeDayText}>×</Text>
                            </TouchableOpacity>
                          )}
                        </RNView>
                      </RNView>

                      {!day.isRestDay && (
                        <>
                          {/* Exercises for this day */}
                          {day.exercises.map((ex, exIndex) => (
                            <RNView key={exIndex} style={styles.exerciseRow}>
                              <Text style={styles.exerciseRowName}>{ex.exercise.name}</Text>
                              <RNView style={styles.setsRepsContainer}>
                                <TextInput
                                  style={styles.setsRepsInput}
                                  value={ex.targetSets.toString()}
                                  onChangeText={(t) => updateExerciseSets(dayIndex, exIndex, parseInt(t) || 0)}
                                  keyboardType="number-pad"
                                  placeholder="3"
                                  placeholderTextColor="#64748b"
                                />
                                <Text style={styles.setsRepsX}>×</Text>
                                <TextInput
                                  style={styles.setsRepsInput}
                                  value={ex.targetReps.toString()}
                                  onChangeText={(t) => updateExerciseReps(dayIndex, exIndex, parseInt(t) || 0)}
                                  keyboardType="number-pad"
                                  placeholder="10"
                                  placeholderTextColor="#64748b"
                                />
                              </RNView>
                              <TouchableOpacity onPress={() => removeExerciseFromDay(dayIndex, exIndex)}>
                                <Text style={styles.removeExText}>×</Text>
                              </TouchableOpacity>
                            </RNView>
                          ))}

                          <TouchableOpacity
                            style={styles.addExerciseBtn}
                            onPress={() => {
                              setEditingDayIndex(dayIndex);
                              setShowExerciseList(true);
                            }}
                          >
                            <Text style={styles.addExerciseBtnText}>+ Add Exercise</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </LinearGradient>
                  ))}

                  {/* Save / Cancel buttons */}
                  <RNView style={styles.customModalButtons}>
                    <TouchableOpacity
                      style={styles.cancelCustomBtn}
                      onPress={() => setShowCreateModal(false)}
                    >
                      <Text style={styles.cancelCustomText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveCustomPlanHandler}>
                      <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.saveCustomBtn}>
                        <Text style={styles.saveCustomText}>Save Plan</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </RNView>
                </ScrollView>

                {/* Exercise Selection Modal */}
                {showExerciseList && (
                  <RNView style={styles.exerciseListOverlay}>
                    <RNView style={styles.exerciseListModal}>
                      <RNView style={styles.exerciseListHeader}>
                        <Text style={styles.exerciseListTitle}>Select Exercise</Text>
                        <TouchableOpacity onPress={() => setShowExerciseList(false)}>
                          <Text style={styles.exerciseListClose}>×</Text>
                        </TouchableOpacity>
                      </RNView>

                      <TextInput
                        style={styles.exerciseSearchInput}
                        value={exerciseSearch}
                        onChangeText={setExerciseSearch}
                        placeholder="Search exercises..."
                        placeholderTextColor="#64748b"
                      />

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                            onPress={() => setSelectedCategory(cat)}
                          >
                            <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <ScrollView style={styles.exerciseListScroll}>
                        {filteredExercises.map((ex) => (
                          <TouchableOpacity
                            key={ex.id}
                            style={styles.exerciseListItem}
                            onPress={() => addExerciseToDay(ex)}
                          >
                            <Text style={styles.exerciseListItemName}>{ex.name}</Text>
                            <Text style={styles.exerciseListItemCat}>{ex.category}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </RNView>
                  </RNView>
                )}
              </RNView>
            </RNView>
          </Modal>
        </RNView>
      </ScrollView>
    </LinearGradient>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#e94560',
  },
  filterText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficulty_beginner: {
    backgroundColor: '#22c55e',
  },
  difficulty_intermediate: {
    backgroundColor: '#f59e0b',
  },
  difficulty_advanced: {
    backgroundColor: '#ef4444',
  },
  difficultyText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  planDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  planDays: {
    fontSize: 12,
    color: '#64748b',
  },
  planDetailsModal: {
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#fff',
  },
  scheduleDay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  scheduleDayNumber: {
    fontWeight: '600',
    color: '#fff',
  },
  scheduleDayName: {
    color: '#94a3b8',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalStartButton: {
    flex: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  startGradient: {
    padding: 14,
    alignItems: 'center',
  },
  modalStartText: {
    color: 'white',
    fontWeight: '700',
  },
  activePlanHeader: {
    marginBottom: 20,
  },
  activePlanName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  dayNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dayNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNavText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
  dayNavDisabled: {
    color: '#374151',
  },
  activePlanProgress: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  todayCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  todayTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  todayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  restDay: {
    alignItems: 'center',
    padding: 20,
  },
  restDayText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4ade80',
  },
  restDaySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  exerciseItemLeft: {
    flex: 1,
  },
  exerciseItemName: {
    fontSize: 16,
    color: '#fff',
  },
  exerciseItemSets: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: '600',
    marginTop: 2,
  },
  videoIcon: {
    backgroundColor: '#ef4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  videoIconText: {
    color: '#fff',
    fontSize: 12,
  },
  completeButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 20,
  },
  completeGradient: {
    padding: 16,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  weekOverview: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  weekHint: {
    fontSize: 11,
    color: '#64748b',
  },
  weekDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  weekDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCompleted: {
    backgroundColor: '#22c55e',
  },
  weekDayCurrent: {
    borderWidth: 2,
    borderColor: '#e94560',
  },
  weekDayText: {
    fontWeight: '600',
    color: '#64748b',
    fontSize: 14,
  },
  weekDayTextCompleted: {
    color: 'white',
  },
  weekDayTextCurrent: {
    color: '#fff',
  },
  weekDayRest: {
    fontSize: 8,
    color: '#64748b',
    position: 'absolute',
    bottom: 4,
  },
  cancelPlanButton: {
    padding: 16,
  },
  cancelPlanText: {
    textAlign: 'center',
    color: '#ef4444',
  },
  // Custom plan styles
  createCustomButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  createCustomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  customPlanModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  customModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addDayButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addDayText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  dayCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayNameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  restToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  restToggleActive: {
    backgroundColor: '#4ade80',
  },
  restToggleText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  restToggleTextActive: {
    color: '#fff',
  },
  removeDayText: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: '300',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  exerciseRowName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  setsRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  setsRepsInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    width: 40,
    textAlign: 'center',
    padding: 6,
    borderRadius: 6,
    fontSize: 14,
  },
  setsRepsX: {
    color: '#64748b',
    marginHorizontal: 4,
  },
  removeExText: {
    color: '#ef4444',
    fontSize: 20,
  },
  addExerciseBtn: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  addExerciseBtnText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  customModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelCustomBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  cancelCustomText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  saveCustomBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveCustomText: {
    color: '#fff',
    fontWeight: '700',
  },
  exerciseListOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 10,
  },
  exerciseListModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  exerciseListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  exerciseListClose: {
    fontSize: 28,
    color: '#fff',
  },
  exerciseSearchInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#e94560',
  },
  categoryChipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  exerciseListScroll: {
    maxHeight: 300,
  },
  exerciseListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  exerciseListItemName: {
    color: '#fff',
    fontSize: 14,
  },
  exerciseListItemCat: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
