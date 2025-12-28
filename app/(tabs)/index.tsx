import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ImageBackground, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { useClerk } from '@clerk/clerk-expo';
import { getMealsByDate, getWorkoutsByDate } from '@/services/firestore';
import { Workout } from '@/types';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AccountMenu from '@/components/AccountMenu';

export default function DashboardScreen() {
  const { userId, userProfile, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const calorieGoal = userProfile?.calorieGoal || 2000;

  useEffect(() => {
    if (userId) {
      loadTodayData();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadTodayData = async () => {
    if (!userId) return;

    try {
      const [meals, workouts] = await Promise.all([
        getMealsByDate(userId, today),
        getWorkoutsByDate(userId, today)
      ]);

      const totalCalories = meals.reduce(
        (sum, meal) => sum + (meal.foodItem.calories * meal.quantity),
        0
      );

      setTodayCalories(totalCalories);
      setTodayWorkouts(workouts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(tabs)');
  };

  if (!isSignedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradientContainer}>
        <RNView style={styles.heroContainer}>
          <Text style={styles.heroTitle}>LIFTr</Text>
          <Text style={styles.heroTagline}>Track. Lift. Transform.</Text>
          <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/login')}>
            <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.heroButtonGradient}>
              <Text style={styles.heroButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </RNView>
      </LinearGradient>
    );
  }

  const calorieProgress = Math.min((todayCalories / calorieGoal) * 100, 100);
  const remainingCalories = calorieGoal - todayCalories;

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradientContainer}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <RNView style={styles.container}>
          {/* Header with greeting and account button */}
          <RNView style={styles.header}>
            <RNView style={styles.headerLeft}>
              <Text style={styles.greeting}>Hey, {userProfile?.displayName?.split(' ')[0] || 'Champ'}!</Text>
              <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            </RNView>
            <TouchableOpacity style={styles.accountButton} onPress={() => setShowAccountMenu(true)}>
              <RNView style={styles.accountCircle}>
                <Text style={styles.accountInitial}>
                  {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </RNView>
            </TouchableOpacity>
          </RNView>

          {/* Calorie Card */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.card}>
            <RNView style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Calories</Text>
              <Text style={styles.cardSubtitle}>{todayCalories} / {calorieGoal}</Text>
            </RNView>
            <RNView style={styles.progressContainer}>
              <RNView style={styles.progressBar}>
                <LinearGradient
                  colors={calorieProgress >= 100 ? ['#ff6b6b', '#e94560'] : ['#4ade80', '#22c55e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${calorieProgress}%` }]}
                />
              </RNView>
            </RNView>
            <RNView style={styles.statsRow}>
              <RNView style={styles.statItem}>
                <Text style={styles.statValue}>{todayCalories}</Text>
                <Text style={styles.statLabel}>Eaten</Text>
              </RNView>
              <RNView style={styles.statDivider} />
              <RNView style={styles.statItem}>
                <Text style={[styles.statValue, remainingCalories < 0 && styles.negative]}>
                  {Math.abs(remainingCalories)}
                </Text>
                <Text style={styles.statLabel}>{remainingCalories >= 0 ? 'Left' : 'Over'}</Text>
              </RNView>
            </RNView>
          </LinearGradient>

          {/* Quick Actions */}
          <RNView style={styles.quickActions}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/calories')}>
              <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>+</Text>
              </LinearGradient>
              <Text style={styles.actionText}>Log Food</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/workouts')}>
              <LinearGradient colors={['#e94560', '#ff6b6b']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>💪</Text>
              </LinearGradient>
              <Text style={styles.actionText}>Workout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/plans')}>
              <LinearGradient colors={['#3b82f6', '#60a5fa']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>📋</Text>
              </LinearGradient>
              <Text style={styles.actionText}>Plans</Text>
            </TouchableOpacity>
          </RNView>

          {/* Today's Workouts */}
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.card}>
            <Text style={styles.cardTitle}>Today's Activity</Text>
            {todayWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>No workouts yet - let's change that!</Text>
            ) : (
              todayWorkouts.map((workout) => (
                <RNView key={workout.id} style={styles.workoutItem}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutDuration}>{workout.duration}m</Text>
                </RNView>
              ))
            )}
          </LinearGradient>
        </RNView>
      </ScrollView>

      <AccountMenu
        visible={showAccountMenu}
        onClose={() => setShowAccountMenu(false)}
        onSignOut={handleSignOut}
        userInitial={userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'transparent',
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  heroTagline: {
    fontSize: 18,
    color: '#94a3b8',
    marginTop: 10,
    letterSpacing: 2,
  },
  heroButton: {
    marginTop: 50,
    borderRadius: 30,
    overflow: 'hidden',
  },
  heroButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 50,
  },
  heroButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  accountButton: {
    padding: 4,
  },
  accountCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
  },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  progressContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#374151',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  negative: {
    color: '#ef4444',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
    color: '#fff',
  },
  actionText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 16,
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    backgroundColor: 'transparent',
  },
  workoutName: {
    fontSize: 14,
    color: '#fff',
  },
  workoutDuration: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: '600',
  },
});
