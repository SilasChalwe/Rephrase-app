import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';

import { APP_CONFIG } from './config/env';

export const FIREBASE_APP = getApps().length
  ? getApp()
  : initializeApp(APP_CONFIG.firebase);

let authInstance;

try {
  authInstance = initializeAuth(FIREBASE_APP, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  authInstance = getAuth(FIREBASE_APP);
}

export const FIREBASE_AUTH = authInstance;
