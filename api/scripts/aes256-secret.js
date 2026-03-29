const fs = require('fs');
const path = require('path');

const { encryptAes256Gcm, generateAes256KeyHex } = require('../src/utils/secrets');

const args = process.argv.slice(2);
const shouldGenerateKey = args.includes('--generate-key');
const fileArgIndex = args.findIndex((arg) => arg === '--file' || arg.startsWith('--file='));
const filePath =
  fileArgIndex === -1
    ? ''
    : args[fileArgIndex].startsWith('--file=')
      ? args[fileArgIndex].slice('--file='.length)
      : args[fileArgIndex + 1] || '';
const plaintext = args.find(
  (arg, index) =>
    !arg.startsWith('--') &&
    !(fileArgIndex !== -1 && index === fileArgIndex + 1 && args[fileArgIndex] === '--file')
);
const providedKey = args.find((arg) => arg.startsWith('--key='))?.slice('--key='.length);

if (!plaintext && !filePath) {
  console.log('Usage:');
  console.log('  node scripts/aes256-secret.js "secret value"');
  console.log('  node scripts/aes256-secret.js "secret value" --key=<64-char-hex-key>');
  console.log('  node scripts/aes256-secret.js "secret value" --generate-key');
  console.log('  node scripts/aes256-secret.js --file=./service-account.json --generate-key');
  process.exit(1);
}

const fileContents = filePath
  ? fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
  : '';
const secretValue = fileContents || plaintext;
const keyHex = shouldGenerateKey || !providedKey ? generateAes256KeyHex() : providedKey;
const encryptedValue = encryptAes256Gcm(secretValue, keyHex);

if (shouldGenerateKey || !providedKey) {
  console.log(`AES_256_SECRET_KEY_HEX=${keyHex}`);
}

console.log(`ENCRYPTED_VALUE=${encryptedValue}`);
