const crypto = require('crypto');

const AES_256_GCM_ALGORITHM = 'aes-256-gcm';
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;

const parseAes256Key = (keyHex) => {
  if (!keyHex) {
    throw new Error('AES_256_SECRET_KEY_HEX is required to decrypt AES-256 secrets.');
  }

  const normalizedKey = String(keyHex).trim();
  if (!/^[0-9a-fA-F]+$/.test(normalizedKey)) {
    throw new Error('AES_256_SECRET_KEY_HEX must be a hex-encoded 32-byte key.');
  }

  const key = Buffer.from(normalizedKey, 'hex');
  if (key.length !== AES_256_KEY_BYTES) {
    throw new Error('AES_256_SECRET_KEY_HEX must decode to exactly 32 bytes.');
  }

  return key;
};

const decryptAes256Gcm = (encryptedValue, keyHex) => {
  const parts = String(encryptedValue || '').split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Encrypted secret format is invalid. Expected base64(iv):base64(tag):base64(ciphertext).'
    );
  }

  const [ivBase64, tagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(tagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  if (iv.length !== GCM_IV_BYTES) {
    throw new Error('AES-256-GCM IV must be 12 bytes.');
  }

  const key = parseAes256Key(keyHex);
  const decipher = crypto.createDecipheriv(AES_256_GCM_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};

const encryptAes256Gcm = (plaintext, keyHex) => {
  const key = parseAes256Key(keyHex);
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv(AES_256_GCM_ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext || ''), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString(
    'base64'
  )}`;
};

const generateAes256KeyHex = () => crypto.randomBytes(AES_256_KEY_BYTES).toString('hex');

module.exports = {
  decryptAes256Gcm,
  encryptAes256Gcm,
  generateAes256KeyHex,
};
