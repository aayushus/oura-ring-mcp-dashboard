import { getDb } from "../db.js";
import { encrypt, decrypt } from "./crypto.js";

// App settings keys that hold sensitive info (secrets, credentials) and must be encrypted at rest
const SENSITIVE_KEYS = ["oura_client_secret"];

/**
 * Retrieve a setting value from the app_settings table.
 * Automatically decrypts sensitive keys.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key]
  );
  if (!row) return null;

  if (SENSITIVE_KEYS.includes(key)) {
    try {
      return decrypt(row.value);
    } catch (err) {
      console.error(`[Settings] Failed to decrypt sensitive setting '${key}':`, err);
      return null;
    }
  }
  return row.value;
}

/**
 * Set a setting key-value pair.
 * Automatically encrypts sensitive keys.
 */
export async function setSetting(key: string, value: string, userId?: number): Promise<void> {
  const db = await getDb();
  let dbValue = value;

  if (SENSITIVE_KEYS.includes(key)) {
    dbValue = encrypt(value);
  }

  await db.run(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    [key, dbValue, new Date().toISOString(), userId ?? null]
  );
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM app_settings WHERE key = ?`, [key]);
}

export interface OuraCredentials {
  clientId: string | null;
  clientSecret: string | null;
}

/**
 * Retrieve Oura API application credentials.
 * Resolves from database settings store first, falling back to environment variables.
 */
export async function getOuraCredentials(): Promise<OuraCredentials> {
  const dbClientId = await getSetting("oura_client_id");
  const dbClientSecret = await getSetting("oura_client_secret");

  return {
    clientId: dbClientId || process.env.OURA_CLIENT_ID || null,
    clientSecret: dbClientSecret || process.env.OURA_CLIENT_SECRET || null,
  };
}
