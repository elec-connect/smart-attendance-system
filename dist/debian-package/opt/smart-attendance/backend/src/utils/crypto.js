// backend/src/utils/crypto.js
// Chiffrement AES-256-GCM pour les secrets (mots de passe SMTP)
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Récupère la clé de chiffrement depuis .env
 */
function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('❌ ENCRYPTION_KEY manquant dans .env');
  }
  if (keyHex.length !== 64) {
    throw new Error('❌ ENCRYPTION_KEY doit faire 64 caractères hex (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Chiffre un texte en clair
 * @param {string} text - Texte à chiffrer
 * @returns {string} Format : iv:authTag:ciphertext (base64)
 */
function encrypt(text) {
  if (!text) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Déchiffre un texte chiffré
 * @param {string} encryptedData - Format iv:authTag:ciphertext
 * @returns {string} Texte en clair
 */
function decrypt(encryptedData) {
  if (!encryptedData) return '';
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Format de données chiffrées invalide');
  }
  
  const [ivB64, authTagB64, ciphertext] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Test rapide du chiffrement
 */
function selfTest() {
  const test = 'MaCléSecrète123!';
  const encrypted = encrypt(test);
  const decrypted = decrypt(encrypted);
  
  if (test !== decrypted) {
    throw new Error('❌ Test de chiffrement échoué');
  }
  console.log('✅ Chiffrement AES-256-GCM OK');
}

module.exports = { encrypt, decrypt, selfTest };