const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = splitCsv(process.env.ALLOWED_ORIGINS);

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
  firebaseServiceAccountJsonBase64: process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '',
  storageProvider: normalizeStorageProvider(process.env.STORAGE_PROVIDER),
  storageAccess: normalizeStorageAccess(process.env.STORAGE_ACCESS),
  readWriteToken: process.env._READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '',
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 4),
};
