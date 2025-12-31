import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, View as RNView, ActivityIndicator, ImageBackground, Image } from 'react-native';
import { Text } from '@/components/Themed';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendingCode, setResendingCode] = useState(false);
  const [isSecondFactor, setIsSecondFactor] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('rememberedEmail');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Error loading saved email:', error);
      }
    };
    loadSavedEmail();
  }, []);

  const handleSignIn = async () => {
    if (!signInLoaded) {
      Alert.alert('Loading', 'Please wait, authentication is still loading...');
      return;
    }
    if (!signIn) {
      Alert.alert('Error', 'Sign in is not available. Please refresh the page and try again.');
      console.error('signIn object is undefined');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        // Save or clear email based on Remember Me
        if (rememberMe) {
          await AsyncStorage.setItem('rememberedEmail', email);
        } else {
          await AsyncStorage.removeItem('rememberedEmail');
        }
        await setSignInActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else if (result.status === 'needs_first_factor') {
        // Account needs verification
        setNeedsVerification(true);
        const emailFactor = result.supportedFirstFactors?.find(
          (f: any) => f.strategy === 'email_code'
        );
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: (emailFactor as any).emailAddressId,
          });
        }
        Alert.alert(
          'Email Verification Required',
          'Your email is not verified. We\'ve sent a verification code to your email.'
        );
      } else if (result.status === 'needs_second_factor') {
        // Two-factor auth required - treat similar to verification
        setNeedsVerification(true);
        setIsSecondFactor(true);
        try {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
          });
          Alert.alert(
            'Verification Required',
            'We\'ve sent a verification code to your email. Please check your inbox.'
          );
        } catch (e) {
          Alert.alert(
            'Verification Required',
            'Please check your email for a verification code.'
          );
        }
      } else {
        // Catch any other status
        Alert.alert('Sign In Status', `Status: ${result.status}. Please try again or contact support.`);
      }
    } catch (err: any) {
      console.error('Sign in error:', JSON.stringify(err, null, 2));
      const errorCode = err.errors?.[0]?.code;
      const errorMessage = err.errors?.[0]?.message || err.message || 'Unknown error occurred';

      let userMessage = errorMessage;
      if (errorCode === 'form_password_incorrect') {
        userMessage = 'Incorrect password. Please check your credentials and try again.';
      } else if (errorCode === 'form_identifier_not_found') {
        userMessage = 'No account found with this email. Please sign up first.';
      } else if (errorCode === 'session_exists') {
        userMessage = 'You are already signed in.';
      } else if (errorMessage?.toLowerCase().includes('verif')) {
        setNeedsVerification(true);
        userMessage = 'Please verify your email before signing in. Check your inbox for a verification code.';
      }

      Alert.alert('Sign In Failed', userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!signInLoaded || !signIn) {
      Alert.alert('Error', 'Unable to resend code. Please try again.');
      return;
    }

    setResendingCode(true);
    try {
      if (isSecondFactor) {
        // Resend second factor code
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      } else {
        // Resend first factor code
        const emailFactor = signIn.supportedFirstFactors?.find(
          (f: any) => f.strategy === 'email_code'
        );
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: (emailFactor as any).emailAddressId,
          });
          Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
        } else {
          Alert.alert('Error', 'Could not resend verification code.');
        }
      }
    } catch (err: any) {
      console.error('Resend verification error:', err);
      Alert.alert('Error', err.errors?.[0]?.message || 'Failed to resend verification code.');
    } finally {
      setResendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!signInLoaded || !signIn || !verificationCode) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      let result;
      if (isSecondFactor) {
        result = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: verificationCode,
        });
      } else {
        result = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: verificationCode,
        });
      }

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        setNeedsVerification(false);
        setVerificationCode('');
        setIsSecondFactor(false);
        router.replace('/(tabs)');
      } else if (result.status === 'needs_second_factor') {
        // First factor passed, now needs second factor
        setIsSecondFactor(true);
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        Alert.alert('Additional Verification', 'Please check your email for another verification code.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      Alert.alert('Verification Failed', err.errors?.[0]?.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) {
      Alert.alert('Loading', 'Please wait, authentication is still loading...');
      return;
    }
    if (!signUp) {
      Alert.alert('Error', 'Sign up is not available. Please refresh the page and try again.');
      console.error('signUp object is undefined');
      return;
    }

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
      } else if (result.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        Alert.alert(
          'Verify your email',
          'We sent a verification code to your email. Check your inbox.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Check your email', 'Please verify your email to continue');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      const errorCode = err.errors?.[0]?.code;
      const errorMessage = err.errors?.[0]?.message;

      let userMessage = 'Failed to create account';
      if (errorCode === 'form_identifier_exists') {
        userMessage = 'An account with this email already exists. Try signing in instead.';
      } else if (errorCode === 'form_password_pwned') {
        userMessage = 'This password has been compromised. Please choose a different password.';
      } else if (errorCode === 'form_password_length_too_short') {
        userMessage = 'Password is too short. Please use at least 8 characters.';
      } else if (errorMessage) {
        userMessage = errorMessage;
      }

      Alert.alert('Sign Up Failed', userMessage);
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

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }
    if (!signInLoaded || !signIn) {
      Alert.alert('Error', 'Please wait, authentication is loading...');
      return;
    }

    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setResetCodeSent(true);
      Alert.alert('Code Sent', 'Check your email for a password reset code.');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const errorMessage = err.errors?.[0]?.message || 'Failed to send reset code';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) {
      Alert.alert('Error', 'Please enter the reset code and new password');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (!signInLoaded || !signIn) {
      Alert.alert('Error', 'Please wait, authentication is loading...');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        setForgotPassword(false);
        setResetCodeSent(false);
        setResetCode('');
        setNewPassword('');
        Alert.alert('Success', 'Password reset successfully!');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Unable to reset password. Please try again.');
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      const errorMessage = err.errors?.[0]?.message || 'Failed to reset password';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading if Clerk isn't ready
  const clerkReady = signInLoaded && signUpLoaded;

  return (
    <ImageBackground
      source={require('@/assets/images/nbensen6_athletic_woman_sitting_on_gym_bench_after_intense_wo_4191ce07-ef1b-43dd-959e-90883191c5d1_3.png')}
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImagePosition}
      resizeMode="cover"
    >
      <RNView style={styles.overlay}>
        <Image
          source={require('@/assets/images/Outlined Logo.png')}
          style={styles.topRightLogo}
          resizeMode="contain"
        />
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <RNView style={styles.content}>
          <Text style={styles.title}>LIFTr</Text>
          <Text style={styles.subtitle}>
            {!clerkReady
              ? 'Loading...'
              : forgotPassword
                ? resetCodeSent
                  ? 'Enter the code and your new password'
                  : 'Enter your email to reset password'
                : needsVerification
                  ? 'Enter the code sent to your email'
                  : isLogin
                    ? 'Welcome back'
                    : 'Create your account'}
          </Text>

          {!clerkReady ? (
            <RNView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e94560" />
              <Text style={styles.loadingText}>Initializing authentication...</Text>
            </RNView>
          ) : forgotPassword ? (
            <RNView style={styles.verificationContainer}>
              {!resetCodeSent ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#e94560', '#ff6b6b']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? 'Sending...' : 'Send Reset Code'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Reset Code"
                    placeholderTextColor="#64748b"
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    placeholderTextColor="#64748b"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#e94560', '#ff6b6b']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleForgotPassword}
                    disabled={loading}
                  >
                    <Text style={styles.resendText}>Resend Code</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setForgotPassword(false);
                  setResetCodeSent(false);
                  setResetCode('');
                  setNewPassword('');
                }}
              >
                <Text style={styles.backText}>Back to Sign In</Text>
              </TouchableOpacity>
            </RNView>
          ) : needsVerification ? (
            <RNView style={styles.verificationContainer}>
              <RNView style={styles.verificationNotice}>
                <Text style={styles.verificationNoticeText}>
                  Your email needs to be verified before you can sign in.
                </Text>
              </RNView>

              <TextInput
                style={styles.input}
                placeholder="Verification Code"
                placeholderTextColor="#64748b"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#e94560', '#ff6b6b']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Verifying...' : 'Verify Email'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendButton, resendingCode && styles.buttonDisabled]}
                onPress={handleResendVerification}
                disabled={resendingCode}
              >
                <Text style={styles.resendText}>
                  {resendingCode ? 'Sending...' : "Didn't receive a code? Resend"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setNeedsVerification(false);
                  setVerificationCode('');
                  setIsSecondFactor(false);
                }}
              >
                <Text style={styles.backText}>Back to Sign In</Text>
              </TouchableOpacity>
            </RNView>
          ) : (
            <>
              {!isLogin && (
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  placeholderTextColor="#64748b"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              {isLogin && (
                <RNView style={styles.loginOptionsRow}>
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                  >
                    <RNView style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                    </RNView>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setForgotPassword(true)}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </RNView>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#e94560', '#ff6b6b']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsLogin(!isLogin)}
              >
                <LinearGradient
                  colors={isLogin ? ['#3b82f6', '#60a5fa'] : ['#6b7280', '#9ca3af']}
                  style={styles.switchButtonGradient}
                >
                  <Text style={styles.switchText}>
                    {isLogin
                      ? "Don't have an account? Sign Up"
                      : 'Already have an account? Sign In'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </RNView>
        </KeyboardAvoidingView>
      </RNView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImagePosition: {
    objectPosition: 'top center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: '50%',
  },
  topRightLogo: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 80,
    height: 80,
    zIndex: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    color: '#fff',
    letterSpacing: 4,
    fontFamily: 'PermanentMarker',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#64748b',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  buttonGradient: {
    padding: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  switchButtonGradient: {
    padding: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  switchText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 8,
    padding: 12,
  },
  backText: {
    textAlign: 'center',
    color: '#64748b',
  },
  verificationContainer: {
    width: '100%',
  },
  verificationNotice: {
    backgroundColor: '#ff6b6b20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff6b6b40',
  },
  verificationNoticeText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resendButton: {
    marginTop: 16,
    padding: 12,
  },
  resendText: {
    textAlign: 'center',
    color: '#e94560',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 16,
    fontSize: 14,
  },
  loginOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  rememberMeText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  forgotPasswordText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '500',
  },
});
