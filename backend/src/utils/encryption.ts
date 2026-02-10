import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment variable.
 * Must be 32 bytes (64 hex characters).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  try {
    return Buffer.from(key, 'hex');
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be valid hex string');
  }
}

/**
 * Encrypt sensitive data (e.g., API keys).
 * Returns IV and encrypted data as hex, separated by colon.
 * 
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format "iv:encryptedData" (both hex)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data (both as hex)
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data that was encrypted with encrypt().
 * 
 * @param encryptedData - String in format "iv:encryptedData" (both hex)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
