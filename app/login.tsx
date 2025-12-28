import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!signInLoaded || !signIn) return;

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      Alert.alert('Error', err.errors?.[0]?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded || !signUp) return;

    setLoading(true);
    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        // May need email verification depending on Clerk settings
        Alert.alert('Check your email', 'Please verify your email to continue');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      Alert.alert('Error', err.errors?.[0]?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!isLogin && !firstName) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (isLogin) {
      handleSignIn();
    } else {
      handleSignUp();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>LIFTr</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Sign in to continue' : 'Create your account'}
        </Text>

        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchButton: {
    marginTop: 24,
    padding: 12,
  },
  switchText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 14,
  },
  backButton: {
    marginTop: 8,
    padding: 12,
  },
  backText: {
    textAlign: 'center',
    color: '#666',
  },
});
