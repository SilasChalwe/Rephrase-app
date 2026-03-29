import React, { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';

import { FIREBASE_AUTH } from '../firebase';
import {
  setUserPresenceOffline,
  setUserPresenceOnline,
  startUserPresenceSession,
} from '../lib/realtimeChat';

const RootLayout = () => {
  useEffect(() => {
    let currentUserId = '';
    let stopPresenceSession = () => {};
    let appStateSubscription;

    const handleAppStateChange = (nextState) => {
      if (!currentUserId) {
        return;
      }

      if (nextState === 'active') {
        setUserPresenceOnline(currentUserId).catch(() => {});
        return;
      }

      setUserPresenceOffline(currentUserId).catch(() => {});
    };

    const unsubscribeAuth = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      const previousUserId = currentUserId;

      stopPresenceSession();
      appStateSubscription?.remove();
      appStateSubscription = undefined;
      if (previousUserId) {
        setUserPresenceOffline(previousUserId).catch(() => {});
      }

      currentUserId = user?.uid || '';
      if (!currentUserId) {
        return;
      }

      stopPresenceSession = startUserPresenceSession(currentUserId);
      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    });

    return () => {
      unsubscribeAuth();
      stopPresenceSession();
      appStateSubscription?.remove();

      if (currentUserId) {
        setUserPresenceOffline(currentUserId).catch(() => {});
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'index', headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
};

export default RootLayout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
