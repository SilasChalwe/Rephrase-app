const path = require('path');

const env = require('../config/env');

const resolveFileExtension = (originalName, fallbackExtension = '.jpg') => {
  const extension = path.extname(originalName || '').toLowerCase();

  if (extension && /^\.[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return fallbackExtension;
};

const toArrayBuffer = (buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const getVercelBlobToken = () => env.readWriteToken || '';

const loadVercelBlob = () => {
  try {
    return require('@vercel/blob');
  } catch (error) {
    throw new Error(
      'Vercel Blob support is not installed. Run npm install in api/ before using uploads.'
    );
  }
};

const sanitizePathSegment = (value, fallbackValue) =>
  String(value || fallbackValue || 'file')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallbackValue;

const uploadFileToBlob = async ({
  folderPath,
  file,
  fallbackExtension = '.bin',
  preferredName = '',
}) => {
  if (env.storageProvider !== 'vercel-blob') {
    throw new Error(
      `Unsupported STORAGE_PROVIDER "${env.storageProvider}". This backend now supports only "vercel-blob".`
    );
  }

  const token = getVercelBlobToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN or _READ_WRITE_TOKEN must be configured for uploads.');
  }

  const { put } = loadVercelBlob();
  const extension = resolveFileExtension(preferredName || file.originalname, fallbackExtension);
  const rawBaseName = path.basename(preferredName || file.originalname || `file${extension}`, extension);
  const baseName = sanitizePathSegment(rawBaseName, `file-${Date.now()}`);
  const pathname = `${folderPath}/${Date.now()}-${baseName}${extension}`;
  const blob = await put(pathname, toArrayBuffer(file.buffer), {
    access: env.storageAccess,
    addRandomSuffix: true,
    contentType: file.mimetype || 'application/octet-stream',
    token,
  });

  return {
    pathname: blob.pathname,
    url: blob.url,
  };
};

const uploadUserProfileImage = async ({ userId, file }) => {
  const blob = await uploadFileToBlob({
    folderPath: 'users/profile',
    file,
    fallbackExtension: '.jpg',
    preferredName: `${userId}${resolveFileExtension(file.originalname, '.jpg')}`,
  });

  return {
    imageUrl: blob.url,
    pathname: blob.pathname,
    url: blob.url,
  };
};

const uploadChatAttachment = async ({ userId, file }) => {
  const safeOriginalName = sanitizePathSegment(file.originalname, 'attachment');
  const blob = await uploadFileToBlob({
    folderPath: `chat/attachments/${sanitizePathSegment(userId, 'user')}`,
    file,
    fallbackExtension: '.bin',
    preferredName: safeOriginalName,
  });

  return {
    mediaUrl: blob.url,
    pathname: blob.pathname,
    url: blob.url,
    fileName: file.originalname || safeOriginalName,
    mimeType: file.mimetype || 'application/octet-stream',
    fileSize: Number(file.size || file.buffer?.length || 0) || null,
  };
};

module.exports = {
  uploadChatAttachment,
  uploadUserProfileImage,
};
