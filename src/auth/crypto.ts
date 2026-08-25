import crypto from "node:crypto";
import { getAuthSecret } from "./config.js";

const KDF_SALT = "oura-mcp-encryption-salt";
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

let cachedKey: Buffer | null = null;
let cachedLegacyKey: Buffer | null = null;

/**
 * Derive a 256-bit encryption key from the persistent AUTH_SECRET using PBKDF2
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = getAuthSecret();
  cachedKey = crypto.pbkdf2Sync(secret, KDF_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
  return cachedKey;
}

/**
 * Legacy key derivation for backwards compatibility with existing encrypted data
 */
function getLegacyEncryptionKey(): Buffer {
  if (cachedLegacyKey) return cachedLegacyKey;
  const secret = getAuthSecret();
  cachedLegacyKey = crypto.createHash("sha256").update(secret).digest();
  return cachedLegacyKey;
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns a base64 encoded string containing the IV, auth tag, and ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex"); // 16-byte auth tag

  // Combined hex: iv (24 chars) + tag (32 chars) + ciphertext
  const combined = iv.toString("hex") + tag + encrypted;
  return Buffer.from(combined, "hex").toString("base64");
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
export function decrypt(encryptedBase64: string): string {
  const combined = Buffer.from(encryptedBase64, "base64").toString("hex");

  if (combined.length < 56) {
    throw new Error("Invalid cipher format");
  }

  const iv = Buffer.from(combined.slice(0, 24), "hex");
  const tag = Buffer.from(combined.slice(24, 56), "hex");
  const ciphertext = combined.slice(56);

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    // Fallback to legacy SHA-256 key if PBKDF2 decryption fails
    const legacyKey = getLegacyEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", legacyKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
