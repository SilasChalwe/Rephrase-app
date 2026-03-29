const path = require('path');

const env = require('../config/env');

const resolveFileExtension = (originalName) => {
  const extension = path.extname(originalName || '').toLowerCase();

  if (extension && /^\.[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return '.jpg';
};

const toArrayBuffer = (buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const getVercelBlobToken = () => env.storageReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN || '';

const loadVercelBlob = () => {
  try {
    return require('@vercel/blob');
  } catch (error) {
    throw new Error(
      'Vercel Blob support is not installed. Run npm install in api/ before using uploads.'
    );
  }
};

const uploadUserProfileImage = async ({ userId, file }) => {
  if (env.storageProvider !== 'vercel-blob') {
    throw new Error(
      `Unsupported STORAGE_PROVIDER "${env.storageProvider}". This backend now supports only "vercel-blob".`
    );
  }

  const token = getVercelBlobToken();
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN or STORAGE_READ_WRITE_TOKEN must be configured for uploads.'
    );
  }

  const { put } = loadVercelBlob();
  const extension = resolveFileExtension(file.originalname);
  const pathname = `users/profile/${Date.now()}-${userId}${extension}`;
  const blob = await put(pathname, toArrayBuffer(file.buffer), {
    access: env.storageAccess,
    addRandomSuffix: true,
    contentType: file.mimetype || 'application/octet-stream',
    token,
  });

  return {
    imageUrl: blob.url,
    pathname: blob.pathname,
    url: blob.url,
  };
};

module.exports = {
  uploadUserProfileImage,
};
