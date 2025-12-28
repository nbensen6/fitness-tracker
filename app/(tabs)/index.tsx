import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { useClerk } from '@clerk/clerk-expo';
import { getMealsByDate, getWorkoutsByDate } from '@/services/firestore';
import { Workout } from '@/types';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const { userId, userProfile, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

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
      <View style={styles.container}>
        <Text style={styles.title}>LIFTr</Text>
        <Text style={styles.subtitle}>Track your calories and workouts</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.buttonText}>Sign In to Get Started</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const calorieProgress = Math.min((todayCalories / calorieGoal) * 100, 100);
  const remainingCalories = calorieGoal - todayCalories;

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.greeting}>
          Hello, {userProfile?.displayName || 'there'}!
        </Text>

        {/* Calorie Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Calories</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${calorieProgress}%` },
                  calorieProgress >= 100 && styles.progressOverflow
                ]}
              />
            </View>
          </View>
          <View style={styles.calorieStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{todayCalories}</Text>
              <Text style={styles.statLabel}>Eaten</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{calorieGoal}</Text>
              <Text style={styles.statLabel}>Goal</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, remainingCalories < 0 && styles.negative]}>
                {Math.abs(remainingCalories)}
              </Text>
              <Text style={styles.statLabel}>
                {remainingCalories >= 0 ? 'Remaining' : 'Over'}
              </Text>
            </View>
          </View>
        </View>

        {/* Workout Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Workouts</Text>
          {todayWorkouts.length === 0 ? (
            <Text style={styles.emptyText}>No workouts logged today</Text>
          ) : (
            todayWorkouts.map((workout) => (
              <View key={workout.id} style={styles.workoutItem}>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutDuration}>{workout.duration} min</Text>
              </View>
            ))
          )}
          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => router.push('/(tabs)/workouts')}
          >
            <Text style={styles.cardButtonText}>+ Log Workout</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/calories')}
          >
            <Text style={styles.quickActionIcon}>+</Text>
            <Text style={styles.quickActionText}>Add Food</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/plans')}
          >
            <Text style={styles.quickActionIcon}>*</Text>
            <Text style={styles.quickActionText}>View Plan</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 60,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    marginTop: 40,
    marginHorizontal: 40,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  progressOverflow: {
    backgroundColor: '#f44336',
  },
  calorieStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  negative: {
    color: '#f44336',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 12,
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  workoutName: {
    fontSize: 16,
    color: '#333',
  },
  workoutDuration: {
    fontSize: 14,
    color: '#666',
  },
  cardButton: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  cardButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    width: '45%',
  },
  quickActionIcon: {
    fontSize: 28,
    color: '#007AFF',
  },
  quickActionText: {
    marginTop: 8,
    color: '#333',
    fontWeight: '500',
  },
  signOutButton: {
    marginTop: 30,
    padding: 12,
  },
  signOutText: {
    textAlign: 'center',
    color: '#f44336',
  },
});
