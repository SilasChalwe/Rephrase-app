import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';

import { FIREBASE_AUTH } from '../../firebase';
import { buildApiUrl, persistStoredUser } from '../../lib/api';

const getSignInErrorMessage = (error) => {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid credentials.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return error?.message || 'Something went wrong. Please try again later.';
  }
};

const SignIn = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hydrateSignedInUser = async (firebaseUser, fallbackEmail = '') => {
    const token = await firebaseUser.getIdToken();

    const response = await fetch(buildApiUrl('/api/auth/me'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const backendData = contentType.includes('application/json')
      ? await response.json()
      : null;

    if (response.status === 404) {
      Alert.alert('Finish setup', 'Your account exists, but your profile is not complete yet.');
      router.push({
        pathname: '/signup',
        params: {
          completeProfile: '1',
          email: firebaseUser.email ?? fallbackEmail,
          name: firebaseUser.displayName ?? '',
          photoUrl: firebaseUser.photoURL ?? '',
        },
      });
      return;
    }

    if (!response.ok || !backendData) {
      throw new Error(backendData?.message || 'Failed to load your profile.');
    }

    await persistStoredUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? fallbackEmail,
      displayName: backendData.fullName ?? firebaseUser.displayName ?? '',
      photoURL: backendData.profilePictureUrl ?? firebaseUser.photoURL ?? '',
      token,
      refreshToken: firebaseUser.refreshToken,
    });

    Alert.alert('Success', 'Login successful!');
    router.replace('/home');
  };

  const handleSubmit = async () => {
    if (!form.email.trim() || !form.password) {
      Alert.alert('Error', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        FIREBASE_AUTH,
        form.email.trim(),
        form.password
      );
      await hydrateSignedInUser(userCredential.user, form.email.trim());
    } catch (error) {
      Alert.alert('Error', getSignInErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <Image
              resizeMode="contain"
              source={require('../assets/icons/logo_primary.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in with your email and password.</Text>
          </View>

          <View style={styles.glassCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(email) => setForm((current) => ({ ...current, email }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={form.password}
                  onChangeText={(password) => setForm((current) => ({ ...current, password }))}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eyeButton}
                  activeOpacity={0.8}
                >
                  <Image
                    source={
                      showPassword
                        ? require('../assets/icons/Eyeclose.png')
                        : require('../assets/icons/eye.png')
                    }
                    style={styles.eyeIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
            </TouchableOpacity>

            <View style={styles.authRow}>
              <Text style={styles.helperText}>I don't have an account</Text>
              <TouchableOpacity onPress={() => router.push('/signup')} activeOpacity={0.8}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>FutureBrands & CovianHive</Text>
      </View>
    </SafeAreaView>
  );
};

export default SignIn;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14081F',
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 88,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  logo: {
    width: 120,
    height: 56,
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
  glassCard: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 54,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF',
  },
  button: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#F6822F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#14081F',
    fontSize: 16,
    fontWeight: '700',
  },
  authRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  helperText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
  },
  linkText: {
    color: '#FFD08A',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingBottom: 8,
  },
  footerText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
