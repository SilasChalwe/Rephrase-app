import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const firebase = extra.firebase ?? {};

const sanitizeBaseUrl = (value) => String(value || 'http://localhost:8080').replace(/\/+$/, '');

export const APP_CONFIG = {
  apiBaseUrl: sanitizeBaseUrl(extra.apiBaseUrl),
  firebase: {
    apiKey: firebase.apiKey ?? '',
    databaseURL: firebase.databaseURL ?? '',
    projectId: firebase.projectId ?? '',
    messagingSenderId: firebase.messagingSenderId ?? '',
    appId: firebase.appId ?? '',
  },
  googleAuth: {
    androidClientId: extra.googleAuth?.androidClientId ?? '',
    iosClientId: extra.googleAuth?.iosClientId ?? '',
    webClientId: extra.googleAuth?.webClientId ?? '',
  },
};

export const API_BASE_URL = APP_CONFIG.apiBaseUrl;
