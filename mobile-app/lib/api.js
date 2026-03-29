import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config/env';

export const buildApiUrl = (path = '') =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const getStoredUser = async () => {
  const rawUser = await AsyncStorage.getItem('user');

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

export const persistStoredUser = async (user) =>
  AsyncStorage.setItem('user', JSON.stringify(user));

export const clearStoredUser = async () => AsyncStorage.removeItem('user');

export const getAuthToken = async () => {
  const user = await getStoredUser();
  return user?.token ?? null;
};
