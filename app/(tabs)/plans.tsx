import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View as RNView, ImageBackground, Linking } from 'react-native';
import { Text } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { setUserWorkoutPlan, getUserWorkoutPlan, updateUserWorkoutPlan } from '@/services/firestore';
import { WorkoutPlan, UserWorkoutPlan } from '@/types';
import { getAllWorkoutPlans, getWorkoutPlansByDifficulty } from '@/services/workoutDatabase';
import { LinearGradient } from 'expo-linear-gradient';

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

export default function PlansScreen() {
  const { userId, isSignedIn } = useAuth();
  const [activePlan, setActivePlan] = useState<UserWorkoutPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DifficultyFilter>('all');

  const workoutPlans = filter === 'all'
    ? getAllWorkoutPlans()
    : getWorkoutPlansByDifficulty(filter);

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
          setActivePlan(null);
        },
      },
    ]);
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
            <RNView style={styles.container}>
              <RNView style={styles.activePlanHeader}>
                <Text style={styles.activePlanName}>{activePlan.plan.name}</Text>
                <Text style={styles.activePlanProgress}>
                  Week {Math.ceil(activePlan.currentDay / 7)} | Day {activePlan.currentDay}
                </Text>
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

                <TouchableOpacity style={styles.completeButton} onPress={completeDay}>
                  <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.completeGradient}>
                    <Text style={styles.completeButtonText}>
                      {currentDayPlan?.isRestDay ? 'Start Next Day' : 'Complete Workout'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>

              <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.weekOverview}>
                <Text style={styles.weekTitle}>This Week</Text>
                <RNView style={styles.weekDays}>
                  {activePlan.plan.days.slice(0, 7).map((day) => (
                    <RNView
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
                    </RNView>
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
        <RNView style={styles.container}>
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
    maxWidth: '50%',
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
  },
  activePlanProgress: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
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
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#fff',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  weekDayTextCompleted: {
    color: 'white',
  },
  cancelPlanButton: {
    padding: 16,
  },
  cancelPlanText: {
    textAlign: 'center',
    color: '#ef4444',
  },
});
