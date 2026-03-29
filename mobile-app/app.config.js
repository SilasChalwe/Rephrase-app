const fs = require('fs');
const path = require('path');

const baseConfig = require('./app.json');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

const env = parseEnvFile(path.join(__dirname, 'setting.env'));
const fallbackExtra = baseConfig.expo.extra ?? {};

module.exports = {
  expo: {
    ...baseConfig.expo,
    extra: {
      ...fallbackExtra,
      apiBaseUrl: env.API_BASE_URL || 'http://localhost:8080',
      firebase: {
        apiKey: env.FIREBASE_API_KEY || '',
        authDomain: env.FIREBASE_AUTH_DOMAIN || '',
        databaseURL: env.FIREBASE_DATABASE_URL || '',
        projectId: env.FIREBASE_PROJECT_ID || '',
        storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: env.FIREBASE_APP_ID || '',
        measurementId: env.FIREBASE_MEASUREMENT_ID || '',
      },
    },
  },
};
