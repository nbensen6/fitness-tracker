import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { setUserWorkoutPlan, getUserWorkoutPlan, updateUserWorkoutPlan } from '@/services/firestore';
import { WorkoutPlan, UserWorkoutPlan, WorkoutPlanDay } from '@/types';

// Pre-built workout plans
const workoutPlans: WorkoutPlan[] = [
  {
    id: 'ppl',
    name: 'Push/Pull/Legs',
    description: 'Classic 6-day split targeting each muscle group twice per week',
    daysPerWeek: 6,
    difficulty: 'intermediate',
    days: [
      {
        dayNumber: 1,
        name: 'Push Day',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'bench-press', name: 'Bench Press', category: 'chest', equipment: 'Barbell' }, targetSets: 4, targetReps: '8-10' },
          { exercise: { id: 'overhead-press', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'incline-db', name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbell' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'lateral-raise', name: 'Lateral Raises', category: 'shoulders', equipment: 'Dumbbell' }, targetSets: 3, targetReps: '12-15' },
          { exercise: { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'arms', equipment: 'Cable' }, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Pull Day',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'deadlift', name: 'Deadlift', category: 'back', equipment: 'Barbell' }, targetSets: 4, targetReps: '5-6' },
          { exercise: { id: 'pull-up', name: 'Pull Ups', category: 'back', equipment: 'Bodyweight' }, targetSets: 3, targetReps: '6-10' },
          { exercise: { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'face-pull', name: 'Face Pulls', category: 'back', equipment: 'Cable' }, targetSets: 3, targetReps: '15-20' },
          { exercise: { id: 'dumbbell-curl', name: 'Dumbbell Curls', category: 'arms', equipment: 'Dumbbell' }, targetSets: 3, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs Day',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'squat', name: 'Squat', category: 'legs', equipment: 'Barbell' }, targetSets: 4, targetReps: '6-8' },
          { exercise: { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'rdl', name: 'Romanian Deadlift', category: 'legs', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'leg-curl', name: 'Leg Curl', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'calf-raise', name: 'Calf Raises', category: 'legs', equipment: 'Machine' }, targetSets: 4, targetReps: '12-15' },
        ],
      },
      { dayNumber: 4, name: 'Push Day', isRestDay: false, exercises: [] },
      { dayNumber: 5, name: 'Pull Day', isRestDay: false, exercises: [] },
      { dayNumber: 6, name: 'Legs Day', isRestDay: false, exercises: [] },
      { dayNumber: 7, name: 'Rest Day', isRestDay: true, exercises: [] },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3x/Week',
    description: 'Hit every muscle group 3 times per week. Great for beginners.',
    daysPerWeek: 3,
    difficulty: 'beginner',
    days: [
      {
        dayNumber: 1,
        name: 'Full Body A',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'squat', name: 'Squat', category: 'legs', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'bench-press', name: 'Bench Press', category: 'chest', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'overhead-press', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'plank', name: 'Plank', category: 'core', equipment: 'Bodyweight' }, targetSets: 3, targetReps: '30-60s' },
        ],
      },
      { dayNumber: 2, name: 'Rest', isRestDay: true, exercises: [] },
      {
        dayNumber: 3,
        name: 'Full Body B',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'deadlift', name: 'Deadlift', category: 'back', equipment: 'Barbell' }, targetSets: 3, targetReps: '5-6' },
          { exercise: { id: 'incline-db', name: 'Incline Dumbbell Press', category: 'chest', equipment: 'Dumbbell' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', equipment: 'Cable' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'dumbbell-curl', name: 'Dumbbell Curls', category: 'arms', equipment: 'Dumbbell' }, targetSets: 2, targetReps: '10-12' },
          { exercise: { id: 'tricep-dip', name: 'Tricep Dips', category: 'arms', equipment: 'Bodyweight' }, targetSets: 2, targetReps: '8-12' },
        ],
      },
      { dayNumber: 4, name: 'Rest', isRestDay: true, exercises: [] },
      {
        dayNumber: 5,
        name: 'Full Body C',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'push-up', name: 'Push Ups', category: 'chest', equipment: 'Bodyweight' }, targetSets: 3, targetReps: 'AMRAP' },
          { exercise: { id: 'pull-up', name: 'Pull Ups', category: 'back', equipment: 'Bodyweight' }, targetSets: 3, targetReps: 'AMRAP' },
          { exercise: { id: 'lateral-raise', name: 'Lateral Raises', category: 'shoulders', equipment: 'Dumbbell' }, targetSets: 3, targetReps: '12-15' },
          { exercise: { id: 'leg-curl', name: 'Leg Curls', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
        ],
      },
      { dayNumber: 6, name: 'Rest', isRestDay: true, exercises: [] },
      { dayNumber: 7, name: 'Rest', isRestDay: true, exercises: [] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper/Lower Split',
    description: '4-day split alternating between upper and lower body',
    daysPerWeek: 4,
    difficulty: 'intermediate',
    days: [
      {
        dayNumber: 1,
        name: 'Upper Body A',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'bench-press', name: 'Bench Press', category: 'chest', equipment: 'Barbell' }, targetSets: 4, targetReps: '6-8' },
          { exercise: { id: 'barbell-row', name: 'Barbell Row', category: 'back', equipment: 'Barbell' }, targetSets: 4, targetReps: '6-8' },
          { exercise: { id: 'overhead-press', name: 'Overhead Press', category: 'shoulders', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'pull-up', name: 'Pull Ups', category: 'back', equipment: 'Bodyweight' }, targetSets: 3, targetReps: '6-10' },
          { exercise: { id: 'dumbbell-curl', name: 'Dumbbell Curls', category: 'arms', equipment: 'Dumbbell' }, targetSets: 2, targetReps: '10-12' },
          { exercise: { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'arms', equipment: 'Cable' }, targetSets: 2, targetReps: '10-12' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Lower Body A',
        isRestDay: false,
        exercises: [
          { exercise: { id: 'squat', name: 'Squat', category: 'legs', equipment: 'Barbell' }, targetSets: 4, targetReps: '6-8' },
          { exercise: { id: 'rdl', name: 'Romanian Deadlift', category: 'legs', equipment: 'Barbell' }, targetSets: 3, targetReps: '8-10' },
          { exercise: { id: 'leg-press', name: 'Leg Press', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'leg-curl', name: 'Leg Curl', category: 'legs', equipment: 'Machine' }, targetSets: 3, targetReps: '10-12' },
          { exercise: { id: 'calf-raise', name: 'Calf Raises', category: 'legs', equipment: 'Machine' }, targetSets: 4, targetReps: '12-15' },
        ],
      },
      { dayNumber: 3, name: 'Rest', isRestDay: true, exercises: [] },
      { dayNumber: 4, name: 'Upper Body B', isRestDay: false, exercises: [] },
      { dayNumber: 5, name: 'Lower Body B', isRestDay: false, exercises: [] },
      { dayNumber: 6, name: 'Rest', isRestDay: true, exercises: [] },
      { dayNumber: 7, name: 'Rest', isRestDay: true, exercises: [] },
    ],
  },
];

export default function PlansScreen() {
  const { userId, isSignedIn } = useAuth();
  const [activePlan, setActivePlan] = useState<UserWorkoutPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadActivePlan();
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

  const startPlan = async (plan: WorkoutPlan) => {
    if (!userId) {
      Alert.alert('Please sign in', 'You need to sign in to start a plan.');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
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

  const completeDay = async () => {
    if (!activePlan) return;

    try {
      const newCompletedDays = [...activePlan.completedDays, activePlan.currentDay];
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

      Alert.alert('Day Completed', 'Great work! Keep it up!');
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
          // Note: In a real app, you'd delete or archive the plan
          setActivePlan(null);
        },
      },
    ]);
  };

  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to access workout plans</Text>
      </View>
    );
  }

  // Show active plan
  if (activePlan && !selectedPlan) {
    const currentDayPlan = activePlan.plan.days.find(
      (d) => d.dayNumber === activePlan.currentDay
    );

    return (
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <View style={styles.activePlanHeader}>
            <Text style={styles.activePlanName}>{activePlan.plan.name}</Text>
            <Text style={styles.activePlanProgress}>
              Week {Math.ceil(activePlan.currentDay / 7)} | Day {activePlan.currentDay}
            </Text>
          </View>

          <View style={styles.todayCard}>
            <Text style={styles.todayTitle}>Today's Workout</Text>
            <Text style={styles.todayName}>{currentDayPlan?.name}</Text>

            {currentDayPlan?.isRestDay ? (
              <View style={styles.restDay}>
                <Text style={styles.restDayText}>Rest Day</Text>
                <Text style={styles.restDaySubtext}>
                  Recovery is important! Take it easy today.
                </Text>
              </View>
            ) : (
              <>
                {currentDayPlan?.exercises.map((ex, index) => (
                  <View key={index} style={styles.exerciseItem}>
                    <Text style={styles.exerciseItemName}>{ex.exercise.name}</Text>
                    <Text style={styles.exerciseItemSets}>
                      {ex.targetSets} sets x {ex.targetReps}
                    </Text>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.completeButton} onPress={completeDay}>
              <Text style={styles.completeButtonText}>
                {currentDayPlan?.isRestDay ? 'Start Next Day' : 'Complete Workout'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekOverview}>
            <Text style={styles.weekTitle}>This Week</Text>
            <View style={styles.weekDays}>
              {activePlan.plan.days.slice(0, 7).map((day) => (
                <View
                  key={day.dayNumber}
                  style={[
                    styles.weekDay,
                    activePlan.completedDays.includes(day.dayNumber) && styles.weekDayCompleted,
                    day.dayNumber === activePlan.currentDay && styles.weekDayCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayText,
                      activePlan.completedDays.includes(day.dayNumber) && styles.weekDayTextCompleted,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.cancelPlanButton} onPress={cancelPlan}>
            <Text style={styles.cancelPlanText}>Cancel Plan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Show plan selection
  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.title}>Choose a Workout Plan</Text>
        <Text style={styles.subtitle}>
          Select a plan that fits your schedule and goals
        </Text>

        {workoutPlans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={styles.planCard}
            onPress={() => setSelectedPlan(plan)}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={[styles.difficultyBadge, styles[`difficulty_${plan.difficulty}`]]}>
                <Text style={styles.difficultyText}>{plan.difficulty}</Text>
              </View>
            </View>
            <Text style={styles.planDescription}>{plan.description}</Text>
            <Text style={styles.planDays}>{plan.daysPerWeek} days per week</Text>
          </TouchableOpacity>
        ))}

        {/* Plan Details Modal */}
        {selectedPlan && (
          <View style={styles.planDetailsModal}>
            <Text style={styles.modalTitle}>{selectedPlan.name}</Text>
            <Text style={styles.modalDescription}>{selectedPlan.description}</Text>

            <Text style={styles.scheduleTitle}>Weekly Schedule</Text>
            {selectedPlan.days.map((day) => (
              <View key={day.dayNumber} style={styles.scheduleDay}>
                <Text style={styles.scheduleDayNumber}>Day {day.dayNumber}</Text>
                <Text style={styles.scheduleDayName}>
                  {day.isRestDay ? 'Rest' : day.name}
                </Text>
              </View>
            ))}

            <View style={styles.modalButtons}>
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
                <Text style={styles.modalStartText}>Start Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
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
    color: '#333',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficulty_beginner: {
    backgroundColor: '#4CAF50',
  },
  difficulty_intermediate: {
    backgroundColor: '#FF9800',
  },
  difficulty_advanced: {
    backgroundColor: '#f44336',
  },
  difficultyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  planDays: {
    fontSize: 12,
    color: '#999',
  },
  planDetailsModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  scheduleDay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scheduleDayNumber: {
    fontWeight: '600',
    color: '#333',
  },
  scheduleDayName: {
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  modalCancelText: {
    textAlign: 'center',
    color: '#666',
  },
  modalStartButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 8,
  },
  modalStartText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  activePlanHeader: {
    marginBottom: 20,
  },
  activePlanName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  activePlanProgress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  todayCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  todayTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  todayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  restDay: {
    alignItems: 'center',
    padding: 20,
  },
  restDayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  restDaySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  exerciseItemName: {
    fontSize: 16,
    color: '#333',
  },
  exerciseItemSets: {
    fontSize: 14,
    color: '#666',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  completeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  weekOverview: {
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCompleted: {
    backgroundColor: '#4CAF50',
  },
  weekDayCurrent: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  weekDayText: {
    fontWeight: '600',
    color: '#333',
  },
  weekDayTextCompleted: {
    color: 'white',
  },
  cancelPlanButton: {
    padding: 16,
  },
  cancelPlanText: {
    textAlign: 'center',
    color: '#f44336',
  },
});
