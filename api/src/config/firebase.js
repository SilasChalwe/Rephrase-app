const fs = require('fs');
const path = require('path');

const admin = require('firebase-admin');

const env = require('./env');

const resolveServiceAccount = () => {
  if (env.firebaseServiceAccountJson) {
    try {
      return JSON.parse(env.firebaseServiceAccountJson);
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON.');
    }
  }

  if (!env.firebaseServiceAccountPath) {
    throw new Error(
      'Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_JSON_AES256 in the backend environment.'
    );
  }

  const serviceAccountPath = path.isAbsolute(env.firebaseServiceAccountPath)
    ? env.firebaseServiceAccountPath
    : path.resolve(__dirname, '../../', env.firebaseServiceAccountPath);

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account file not found at ${serviceAccountPath}.`);
  }

  return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
};

const serviceAccount = resolveServiceAccount();

if (!admin.apps.length) {
  const firebaseConfig = {
    credential: admin.credential.cert(serviceAccount),
  };

  const databaseUrl = env.firebaseDatabaseUrl || serviceAccount.databaseURL;
  if (databaseUrl) {
    firebaseConfig.databaseURL = databaseUrl;
  }

  admin.initializeApp(firebaseConfig);
}

module.exports = {
  admin,
  auth: admin.auth(),
  firestore: admin.firestore(),
};
