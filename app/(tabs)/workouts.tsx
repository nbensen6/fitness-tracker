import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ImageBackground, View as RNView, Linking } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { addWorkout, getRecentWorkouts } from '@/services/firestore';
import { Exercise, WorkoutExercise, Workout } from '@/types';
import { EXERCISES, getExercisesByCategory } from '@/services/workoutDatabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function WorkoutsScreen() {
  const { userId, isSignedIn } = useAuth();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const today = new Date().toISOString().split('T')[0];
  const categories = ['all', 'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'];

  const filteredExercises = selectedCategory === 'all'
    ? EXERCISES
    : getExercisesByCategory(selectedCategory);

  useEffect(() => {
    if (userId) {
      loadRecentWorkouts();
    }
  }, [userId]);

  const loadRecentWorkouts = async () => {
    if (!userId) return;
    try {
      const workouts = await getRecentWorkouts(userId, 5);
      setRecentWorkouts(workouts);
    } catch (error) {
      console.error('Error loading workouts:', error);
    }
  };

  const startWorkout = () => {
    setWorkoutStarted(true);
    setStartTime(new Date());
    setWorkoutName(`Workout - ${new Date().toLocaleDateString()}`);
  };

  const addExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      exercise,
      sets: [{ reps: 0, weight: 0, completed: false }],
    };
    setWorkoutExercises([...workoutExercises, newExercise]);
    setShowExerciseList(false);
  };

  const addSet = (exerciseIndex: number) => {
    const updated = [...workoutExercises];
    const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
    updated[exerciseIndex].sets.push({
      reps: lastSet?.reps || 0,
      weight: lastSet?.weight || 0,
      completed: false,
    });
    setWorkoutExercises(updated);
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weight',
    value: string
  ) => {
    const updated = [...workoutExercises];
    updated[exerciseIndex].sets[setIndex][field] = parseInt(value) || 0;
    setWorkoutExercises(updated);
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const updated = [...workoutExercises];
    updated[exerciseIndex].sets[setIndex].completed =
      !updated[exerciseIndex].sets[setIndex].completed;
    setWorkoutExercises(updated);
  };

  const removeExercise = (index: number) => {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  };

  const openYouTubeSearch = (exerciseName: string) => {
    const searchQuery = encodeURIComponent(`${exerciseName} exercise how to`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${searchQuery}`);
  };

  const finishWorkout = async () => {
    if (!userId || workoutExercises.length === 0) {
      Alert.alert('Error', 'Add at least one exercise to save the workout');
      return;
    }

    const duration = startTime
      ? Math.round((new Date().getTime() - startTime.getTime()) / 60000)
      : 0;

    try {
      await addWorkout(userId, {
        name: workoutName || 'Workout',
        exercises: workoutExercises,
        date: today,
        duration,
        completed: true,
      });

      Alert.alert('Workout Saved', `Great job! Duration: ${duration} minutes`);
      setWorkoutStarted(false);
      setWorkoutExercises([]);
      setWorkoutName('');
      setStartTime(null);
      loadRecentWorkouts();
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  const cancelWorkout = () => {
    Alert.alert('Cancel Workout', 'Are you sure you want to cancel this workout?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          setWorkoutStarted(false);
          setWorkoutExercises([]);
          setWorkoutName('');
          setStartTime(null);
        },
      },
    ]);
  };

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
        <RNView style={styles.messageContainer}>
          <Text style={styles.message}>Please sign in to log workouts</Text>
        </RNView>
      </LinearGradient>
    );
  }

  if (!workoutStarted) {
    return (
      <ImageBackground
        source={require('@/assets/images/gym-equipment.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <RNView style={styles.overlay}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <RNView style={styles.container}>
              <Text style={styles.title}>Workouts</Text>

              <TouchableOpacity onPress={startWorkout}>
                <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.startButton}>
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </LinearGradient>
              </TouchableOpacity>

              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Workouts</Text>
                {recentWorkouts.length === 0 ? (
                  <Text style={styles.emptyText}>No recent workouts</Text>
                ) : (
                  recentWorkouts.map((workout) => (
                    <RNView key={workout.id} style={styles.workoutCard}>
                      <RNView style={styles.workoutInfo}>
                        <Text style={styles.workoutName}>{workout.name}</Text>
                        <Text style={styles.workoutDetails}>
                          {workout.exercises.length} exercises | {workout.duration} min
                        </Text>
                      </RNView>
                      <Text style={styles.workoutDate}>{workout.date}</Text>
                    </RNView>
                  ))
                )}
              </LinearGradient>
            </RNView>
          </ScrollView>
        </RNView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/gym-equipment.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <RNView style={styles.overlay}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <RNView style={styles.container}>
            {/* Workout Header */}
            <TextInput
              style={styles.workoutNameInput}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Workout Name"
              placeholderTextColor="#64748b"
            />

            {/* Exercise List */}
            {workoutExercises.map((workoutExercise, exerciseIndex) => (
              <LinearGradient key={exerciseIndex} colors={['#2d2d44', '#1f1f2e']} style={styles.exerciseCard}>
                <RNView style={styles.exerciseHeader}>
                  <RNView style={styles.exerciseNameRow}>
                    <Text style={styles.exerciseName}>
                      {workoutExercise.exercise.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.videoButton}
                      onPress={() => openYouTubeSearch(workoutExercise.exercise.name)}
                    >
                      <Text style={styles.videoButtonText}>Watch</Text>
                    </TouchableOpacity>
                  </RNView>
                  <TouchableOpacity onPress={() => removeExercise(exerciseIndex)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </RNView>

                {/* Sets */}
                <RNView style={styles.setsHeader}>
                  <Text style={styles.setHeaderText}>Set</Text>
                  <Text style={styles.setHeaderText}>Weight</Text>
                  <Text style={styles.setHeaderText}>Reps</Text>
                  <Text style={styles.setHeaderText}>Done</Text>
                </RNView>

                {workoutExercise.sets.map((set, setIndex) => (
                  <RNView key={setIndex} style={styles.setRow}>
                    <Text style={styles.setNumber}>{setIndex + 1}</Text>
                    <TextInput
                      style={styles.setInput}
                      keyboardType="numeric"
                      value={set.weight ? set.weight.toString() : ''}
                      onChangeText={(val) =>
                        updateSet(exerciseIndex, setIndex, 'weight', val)
                      }
                      placeholder="0"
                      placeholderTextColor="#64748b"
                    />
                    <TextInput
                      style={styles.setInput}
                      keyboardType="numeric"
                      value={set.reps ? set.reps.toString() : ''}
                      onChangeText={(val) =>
                        updateSet(exerciseIndex, setIndex, 'reps', val)
                      }
                      placeholder="0"
                      placeholderTextColor="#64748b"
                    />
                    <TouchableOpacity
                      style={[
                        styles.checkButton,
                        set.completed && styles.checkButtonActive,
                      ]}
                      onPress={() => toggleSetComplete(exerciseIndex, setIndex)}
                    >
                      <Text style={[styles.checkText, set.completed && styles.checkTextActive]}>
                        {set.completed ? '✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  </RNView>
                ))}

                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
              </LinearGradient>
            ))}

            {/* Add Exercise Button */}
            <TouchableOpacity onPress={() => setShowExerciseList(true)}>
              <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.addExerciseButton}>
                <Text style={styles.addExerciseText}>+ Add Exercise</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Exercise Selection Modal */}
            {showExerciseList && (
              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.exerciseListModal}>
                <RNView style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Exercise</Text>
                  <TouchableOpacity onPress={() => setShowExerciseList(false)}>
                    <Text style={styles.closeButton}>Close</Text>
                  </TouchableOpacity>
                </RNView>

                {/* Category Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryButton, selectedCategory === cat && styles.categoryButtonActive]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView style={styles.exerciseList}>
                  {filteredExercises.map((exercise) => (
                    <TouchableOpacity
                      key={exercise.id}
                      style={styles.exerciseOption}
                      onPress={() => addExercise(exercise)}
                    >
                      <RNView style={styles.exerciseOptionInfo}>
                        <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                        <Text style={styles.exerciseOptionCategory}>
                          {exercise.category} | {exercise.equipment}
                          {exercise.difficulty && ` | ${exercise.difficulty}`}
                        </Text>
                      </RNView>
                      <TouchableOpacity
                        style={styles.videoIconButton}
                        onPress={() => openYouTubeSearch(exercise.name)}
                      >
                        <Text style={styles.videoIcon}>▶</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </LinearGradient>
            )}

            {/* Action Buttons */}
            <RNView style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelWorkout}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={finishWorkout}>
                <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.finishButton}>
                  <Text style={styles.finishButtonText}>Finish Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </ScrollView>
      </RNView>
    </ImageBackground>
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
    color: '#fff',
    marginBottom: 20,
  },
  startButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  startButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 20,
  },
  workoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  workoutDetails: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  workoutDate: {
    fontSize: 12,
    color: '#4ade80',
  },
  workoutNameInput: {
    fontSize: 20,
    fontWeight: '600',
    padding: 14,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    marginBottom: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  exerciseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  videoButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeText: {
    color: '#ef4444',
    fontSize: 14,
  },
  setsHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  setHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumber: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: '#fff',
  },
  setInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
    textAlign: 'center',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  checkButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  checkButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkText: {
    fontWeight: 'bold',
    color: '#64748b',
  },
  checkTextActive: {
    color: '#fff',
  },
  addSetButton: {
    marginTop: 8,
    padding: 8,
  },
  addSetText: {
    color: '#3b82f6',
    textAlign: 'center',
    fontWeight: '600',
  },
  addExerciseButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseListModal: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    maxHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#e94560',
  },
  categoryText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  exerciseList: {
    maxHeight: 350,
  },
  exerciseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  exerciseOptionInfo: {
    flex: 1,
  },
  exerciseOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  exerciseOptionCategory: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  videoIconButton: {
    backgroundColor: '#ef4444',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: {
    color: '#fff',
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  finishButton: {
    flex: 2,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  finishButtonText: {
    color: 'white',
    fontWeight: '700',
  },
});
