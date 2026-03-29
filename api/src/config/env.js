const path = require('path');
const dotenv = require('dotenv');

const { decryptAes256Gcm } = require('../utils/secrets');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = splitCsv(process.env.ALLOWED_ORIGINS);

const getFirstDefined = (...keys) => {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }

  return '';
};

const getEnvOrEncrypted = (plainKeys, encryptedKeys) => {
  for (const encryptedKey of encryptedKeys) {
    if (process.env[encryptedKey]) {
      return decryptAes256Gcm(process.env[encryptedKey], process.env.AES_256_SECRET_KEY_HEX);
    }
  }

  return getFirstDefined(...plainKeys);
};

const normalizeStorageProvider = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return 'vercel-blob';
  }

  if (['blob', 'vercel', 'vercel-blob'].includes(normalized)) {
    return 'vercel-blob';
  }

  return normalized;
};

const normalizeStorageAccess = (value) =>
  String(value || 'public')
    .trim()
    .toLowerCase() === 'private'
    ? 'private'
    : 'public';

module.exports = {
  port: Number(process.env.PORT || 8080),
  allowedOrigins: allowedOrigins.length
    ? allowedOrigins
    : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'],
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  firebaseServiceAccountJson: getEnvOrEncrypted(
    ['FIREBASE_SERVICE_ACCOUNT_JSON'],
    ['FIREBASE_SERVICE_ACCOUNT_JSON_AES256']
  ),
  storageProvider: normalizeStorageProvider(process.env.STORAGE_PROVIDER),
  storageAccess: normalizeStorageAccess(process.env.STORAGE_ACCESS),
  storageReadWriteToken: getEnvOrEncrypted(
    ['STORAGE_READ_WRITE_TOKEN', 'BLOB_READ_WRITE_TOKEN'],
    ['STORAGE_READ_WRITE_TOKEN_AES256', 'BLOB_READ_WRITE_TOKEN_AES256']
  ),
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 4),
};
