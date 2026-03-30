import React, { useEffect, useState } from 'react';
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { router, useLocalSearchParams } from 'expo-router';

import { FIREBASE_AUTH } from '../../firebase';
import { buildApiUrl, persistStoredUser } from '../../lib/api';

const auth = FIREBASE_AUTH;

const SignUp = () => {
  const params = useLocalSearchParams();
  const isCompletingProfile = params.completeProfile === '1';
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    photoUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      email: params.email ? String(params.email) : currentForm.email,
      name: params.name ? String(params.name) : currentForm.name,
      photoUrl: params.photoUrl ? String(params.photoUrl) : currentForm.photoUrl,
    }));
  }, [params.email, params.name, params.photoUrl]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim() || (!isCompletingProfile && (!form.email.trim() || !form.password))) {
      Alert.alert('Error', 'Please fill in all the fields.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = isCompletingProfile
        ? { user: auth.currentUser }
        : await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);

      if (!userCredential?.user) {
        throw new Error('No authenticated user found for profile completion.');
      }

      const token = await userCredential.user.getIdToken();
      const response = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: form.name.trim(),
          emailAddress: form.email.trim(),
          phoneNumber: form.phone.trim(),
          profilePictureUrl: form.photoUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Something went wrong.');
      }

      const backendData = await response.json();
      await persistStoredUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email ?? form.email.trim(),
        displayName: backendData.fullName ?? form.name.trim(),
        photoURL: backendData.profilePictureUrl ?? form.photoUrl,
        token,
        refreshToken: userCredential.user.refreshToken,
      });

      Alert.alert(
        'Success',
        isCompletingProfile ? 'Profile completed successfully!' : 'Registration successful!'
      );
      router.replace('/home');
    } catch (error) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
            <Text style={styles.title}>{isCompletingProfile ? 'Finish Setup' : 'Create Account'}</Text>
            <Text style={styles.subtitle}>
              {isCompletingProfile
                ? 'Add the last details to finish your account.'
                : 'Create your account with a few details below.'}
            </Text>
          </View>

          <View style={styles.glassCard}>
            {isCompletingProfile ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>{form.email}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>User Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(name) => setForm((current) => ({ ...current, name }))}
                placeholder="Your full name"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
            </View>

            {!isCompletingProfile ? (
              <>
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
                      placeholder="Choose a password"
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
              </>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
                keyboardType="phone-pad"
                placeholder="Your phone number"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading
                  ? isCompletingProfile
                    ? 'Saving...'
                    : 'Registering...'
                  : isCompletingProfile
                    ? 'Complete Profile'
                    : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            {!isCompletingProfile ? (
              <View style={styles.authRow}>
                <Text style={styles.helperText}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/signin')} activeOpacity={0.8}>
                  <Text style={styles.linkText}>Login</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>FutureBrands & CovianHive</Text>
      </View>
    </SafeAreaView>
  );
};

export default SignUp;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#14081F',
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 88,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 56,
    marginBottom: 16,
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
    paddingHorizontal: 12,
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
  readonlyField: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  readonlyText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
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
