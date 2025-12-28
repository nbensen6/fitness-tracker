import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { addWorkout, getRecentWorkouts } from '@/services/firestore';
import { Exercise, ExerciseSet, WorkoutExercise, Workout } from '@/types';

// Common exercises database
const exerciseDatabase: Exercise[] = [
  { id: 'bench-press', name: 'Bench Press', category: 'chest', equipment: 'Barbell' },
  { id: 'squat', name: 'Squat', category: 'legs', equipment: 'Barbell' },
  { id: 'deadlift', name: 'Deadlift', category: 'back', equipment: 'Barbell' },
  { id: 'overhead-press', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' },
  { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell' },
  { id: 'pull-up', name: 'Pull Up', category: 'back', equipment: 'Bodyweight' },
  { id: 'push-up', name: 'Push Up', category: 'chest', equipment: 'Bodyweight' },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', category: 'arms', equipment: 'Dumbbell' },
  { id: 'tricep-dip', name: 'Tricep Dip', category: 'arms', equipment: 'Bodyweight' },
  { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', equipment: 'Cable' },
  { id: 'plank', name: 'Plank', category: 'core', equipment: 'Bodyweight' },
  { id: 'running', name: 'Running', category: 'cardio', equipment: 'None' },
  { id: 'cycling', name: 'Cycling', category: 'cardio', equipment: 'Bike' },
];

export default function WorkoutsScreen() {
  const { userId, isSignedIn } = useAuth();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const today = new Date().toISOString().split('T')[0];

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
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to log workouts</Text>
      </View>
    );
  }

  if (!workoutStarted) {
    return (
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.startButton} onPress={startWorkout}>
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {recentWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>No recent workouts</Text>
            ) : (
              recentWorkouts.map((workout) => (
                <View key={workout.id} style={styles.workoutCard}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutDetails}>
                    {workout.exercises.length} exercises | {workout.duration} min
                  </Text>
                  <Text style={styles.workoutDate}>{workout.date}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        {/* Workout Header */}
        <TextInput
          style={styles.workoutNameInput}
          value={workoutName}
          onChangeText={setWorkoutName}
          placeholder="Workout Name"
        />

        {/* Exercise List */}
        {workoutExercises.map((workoutExercise, exerciseIndex) => (
          <View key={exerciseIndex} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>
                {workoutExercise.exercise.name}
              </Text>
              <TouchableOpacity onPress={() => removeExercise(exerciseIndex)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>

            {/* Sets */}
            <View style={styles.setsHeader}>
              <Text style={styles.setHeaderText}>Set</Text>
              <Text style={styles.setHeaderText}>Weight</Text>
              <Text style={styles.setHeaderText}>Reps</Text>
              <Text style={styles.setHeaderText}>Done</Text>
            </View>

            {workoutExercise.sets.map((set, setIndex) => (
              <View key={setIndex} style={styles.setRow}>
                <Text style={styles.setNumber}>{setIndex + 1}</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  value={set.weight ? set.weight.toString() : ''}
                  onChangeText={(val) =>
                    updateSet(exerciseIndex, setIndex, 'weight', val)
                  }
                  placeholder="0"
                />
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  value={set.reps ? set.reps.toString() : ''}
                  onChangeText={(val) =>
                    updateSet(exerciseIndex, setIndex, 'reps', val)
                  }
                  placeholder="0"
                />
                <TouchableOpacity
                  style={[
                    styles.checkButton,
                    set.completed && styles.checkButtonActive,
                  ]}
                  onPress={() => toggleSetComplete(exerciseIndex, setIndex)}
                >
                  <Text style={styles.checkText}>{set.completed ? 'Y' : ''}</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => addSet(exerciseIndex)}
            >
              <Text style={styles.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Exercise Button */}
        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setShowExerciseList(true)}
        >
          <Text style={styles.addExerciseText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Exercise Selection Modal */}
        {showExerciseList && (
          <View style={styles.exerciseListModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowExerciseList(false)}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.exerciseList}>
              {exerciseDatabase.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseOption}
                  onPress={() => addExercise(exercise)}
                >
                  <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                  <Text style={styles.exerciseOptionCategory}>
                    {exercise.category} | {exercise.equipment}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelWorkout}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishButton} onPress={finishWorkout}>
            <Text style={styles.finishButtonText}>Finish Workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  message: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  startButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  workoutCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  workoutDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  workoutDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  workoutNameInput: {
    fontSize: 20,
    fontWeight: '600',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  removeText: {
    color: '#f44336',
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
    color: '#666',
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
    color: '#333',
  },
  setInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
    marginHorizontal: 4,
    textAlign: 'center',
  },
  checkButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginLeft: 4,
  },
  checkButtonActive: {
    backgroundColor: '#4CAF50',
  },
  checkText: {
    fontWeight: 'bold',
    color: 'white',
  },
  addSetButton: {
    marginTop: 8,
    padding: 8,
  },
  addSetText: {
    color: '#007AFF',
    textAlign: 'center',
  },
  addExerciseButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseListModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  exerciseList: {
    maxHeight: 300,
  },
  exerciseOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  exerciseOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  exerciseOptionCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#f44336',
    textAlign: 'center',
    fontWeight: '600',
  },
  finishButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
  },
  finishButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
});
