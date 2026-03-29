import { View, StyleSheet, Image ,Text, Alert } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { signInWithEmailAndPassword} from 'firebase/auth';
import { FIREBASE_AUTH } from '../../firebase'
import { FormField } from '../components/form';
import CustomButton from '../components/CustomButton';
import { Link, router } from 'expo-router';
import { buildApiUrl, persistStoredUser } from '../../lib/api';

const SignIn = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const auth = FIREBASE_AUTH;

const handleSubmit = async () => {
  if (!form.email || !form.password) {
    Alert.alert('Error', 'Please fill in both email and password.');
    return;
  }

  setLoading(true);

  try {
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);

    // Get token
    const token = await userCredential.user.getIdToken();

    // Send token to backend
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

    if (response.ok && backendData) {
      // Build and store user + token data
      const userDataToStore = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: backendData.fullName ?? '',
        photoURL: backendData.profilePictureUrl ?? '',
        token: token,
        refreshToken: userCredential.user.refreshToken,
      };

      await persistStoredUser(userDataToStore);

      Alert.alert('Success', 'Login successful!');
      router.push('/home');
    } else {
      Alert.alert('Error', 'Invalid credentials');
    }
  } catch (error) {
    Alert.alert('Error', 'Something went wrong. Please try again later.');
  } finally {
    setLoading(false);
  };
};

  return (
    <SafeAreaView>

      <ScrollView style={styles.outer}>
        {/* logo area */}
        <View>
          <Image resizeMode="contain" source={require('../assets/icons/logo_primary.png')} style={styles.img} />
        </View>

        <View>
          <Text style={styles.text}>Sign In</Text>
          <FormField
            title="Email"
            value={form.email.trim()}
            handleChangeText={(e) => setForm({ ...form, email: e })}
            keyboardType="email-address"
          />

          <FormField
            title="Password"
            value={form.password.trim()}
            handleChangeText={(e) => setForm({ ...form, password: e })}
            secureTextEntry
          />


          <CustomButton
          styling={styles.buton}
            title={loading ? 'Logging in...' : 'Login'}
            onPress={()=>{handleSubmit()}}
            //onPress={()=> router.push('/home')}
            disabled={loading}
          />

          <View style={styles.onotherOption}>
            <Text style={styles.text1}>I don't have an account</Text>
            <Link href="/signup" style={styles.links}>
              Sign Up
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;

const styles = StyleSheet.create({
  img: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  buton:{
  backgroundColor:'#FF6600',
  width:400,
  alignSelf:'center'

  },
  outer: {
    alignContents: 'center',
    marginTop: '0%',
    height: '100%',
    backgroundColor: '#1B0333',
  },
  text: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'start',
    marginBottom: 20,
    marginLeft: 15,
  },
  onotherOption: {
    marginTop: 20,
    marginLeft: 15,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  links: {
    color: '#F6822F',
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 17,
    
  },
  text1: {
    color: '#ffff',
    fontWeight: 'bold',
    fontSize: 17,
  },
});
