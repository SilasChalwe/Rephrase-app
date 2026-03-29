const admin = require('firebase-admin');

const env = require('./env');

const resolveServiceAccount = () => {
  if (env.firebaseServiceAccountJsonBase64) {
    try {
      const decodedJson = Buffer.from(env.firebaseServiceAccountJsonBase64, 'base64').toString('utf8');
      return JSON.parse(decodedJson);
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 must contain valid base64-encoded JSON.');
    }
  }

  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 in the backend environment.');
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
  database: admin.database(),
  firestore: admin.firestore(),
};
