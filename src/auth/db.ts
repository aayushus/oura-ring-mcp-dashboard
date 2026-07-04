import { getDb } from "../db.js";

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "member";
  disabled: number;
  created_at: string;
}

export interface AuthSession {
  token_hash: string;
  user_id: number;
  created_at: string;
  expires_at: string;
  last_seen: string | null;
  user_agent: string | null;
}

/**
  * Create a new user account
  */
export async function createUser(
  name: string,
  email: string,
  passwordHash: string,
  role: "admin" | "member" = "member"
): Promise<User> {
  const db = await getDb();
  const lowerEmail = email.toLowerCase().trim();
  
  await db.run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, lowerEmail, passwordHash, role]
  );
  
  const user = await getUserByEmail(lowerEmail);
  if (!user) {
    throw new Error("Failed to retrieve created user");
  }
  return user;
}

/**
  * Fetch a user by email
  */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const lowerEmail = email.toLowerCase().trim();
  const row = await db.get<User>(
    "SELECT id, name, email, password_hash, role, disabled, created_at FROM users WHERE email = ?",
    [lowerEmail]
  );
  return row ?? null;
}

/**
  * Fetch a user by ID
  */
export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  const row = await db.get<User>(
    "SELECT id, name, email, password_hash, role, disabled, created_at FROM users WHERE id = ?",
    [id]
  );
  return row ?? null;
}

/**
  * Create an authenticated session
  */
export async function createSession(
  tokenHash: string,
  userId: number,
  expiresAt: string,
  userAgent: string | null = null
): Promise<void> {
  const db = await getDb();
  await db.run(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)",
    [tokenHash, userId, expiresAt, userAgent]
  );
}

/**
  * Resolve a session and join the user details
  */
export async function getSession(
  tokenHash: string
): Promise<{ session: AuthSession; user: User } | null> {
  const db = await getDb();
  const row = await db.get<any>(
    `SELECT s.token_hash, s.user_id, s.created_at, s.expires_at, s.last_seen, s.user_agent,
            u.name, u.email, u.password_hash, u.role, u.disabled, u.created_at as u_created_at
     FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ?`,
    [tokenHash]
  );
  
  if (!row) return null;
  
  const session: AuthSession = {
    token_hash: row.token_hash,
    user_id: row.user_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    last_seen: row.last_seen,
    user_agent: row.user_agent,
  };
  
  const user: User = {
    id: row.user_id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    disabled: row.disabled,
    created_at: row.u_created_at,
  };
  
  return { session, user };
}

/**
  * Destroy a specific session
  */
export async function deleteSession(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash]);
}

/**
  * Destroy all active sessions of a user
  */
export async function deleteUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM auth_sessions WHERE user_id = ?", [userId]);
}

/**
  * Update the last seen timestamp of a session
  */
export async function updateSessionLastSeen(tokenHash: string, timestamp: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?", [timestamp, tokenHash]);
}

/**
  * Update a user's disable state
  */
export async function updateUserDisabledState(userId: number, disabled: number): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE users SET disabled = ? WHERE id = ?", [disabled, userId]);
  if (disabled === 1) {
    await deleteUserSessions(userId);
  }
}

/**
  * Log a failed login attempt
  */
export async function addLoginAttempt(key: string, timestamp: string): Promise<void> {
  const db = await getDb();
  await db.run("INSERT INTO login_attempts (key, attempted) VALUES (?, ?)", [key, timestamp]);
}

/**
  * Fetch number of recent failed login attempts
  */
export async function getRecentLoginAttemptsCount(key: string, timeCutoff: string): Promise<number> {
  const db = await getDb();
  const row = await db.get<any>(
    "SELECT COUNT(*) as count FROM login_attempts WHERE key = ? AND attempted >= ?",
    [key, timeCutoff]
  );
  return row ? Number(row.count) : 0;
}

/**
  * Prune login attempts older than 1 hour
  */
export async function pruneOldLoginAttempts(timeCutoff: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM login_attempts WHERE attempted < ?", [timeCutoff]);
}

/**
  * Return total count of users registered in the database
  */
export async function countUsers(): Promise<number> {
  const db = await getDb();
  const row = await db.get<any>("SELECT COUNT(*) as count FROM users");
  return row ? Number(row.count) : 0;
}

export interface OuraConnection {
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  connected_at: string;
  last_sync_at: string | null;
  sync_error: string | null;
}

/**
 * Create or update a user's Oura connection
 */
export async function upsertOuraConnection(
  userId: number,
  connection: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scopes: string | null;
  }
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO oura_connections (user_id, access_token, refresh_token, expires_at, scopes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scopes = excluded.scopes,
       connected_at = datetime('now')`,
    [userId, connection.accessToken, connection.refreshToken, connection.expiresAt, connection.scopes]
  );
}

/**
 * Retrieve Oura connection tokens for a user
 */
export async function getOuraConnection(userId: number): Promise<OuraConnection | null> {
  const db = await getDb();
  const row = await db.get<OuraConnection>(
    `SELECT user_id, access_token, refresh_token, expires_at, scopes, connected_at, last_sync_at, sync_error 
     FROM oura_connections WHERE user_id = ?`,
    [userId]
  );
  return row || null;
}

/**
 * Remove Oura connection details for a user
 */
export async function deleteOuraConnection(userId: number): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM oura_connections WHERE user_id = ?`, [userId]);
}

/**
 * Fetch all Oura connections for scheduler loop
 */
export async function getAllOuraConnections(): Promise<OuraConnection[]> {
  const db = await getDb();
  return db.all<OuraConnection[]>(`SELECT user_id, access_token, refresh_token, expires_at, scopes, connected_at, last_sync_at, sync_error FROM oura_connections`);
}

/**
 * Update the last sync details
 */
export async function updateOuraSyncStatus(userId: number, error: string | null): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE oura_connections SET
       last_sync_at = datetime('now'),
       sync_error = ?
     WHERE user_id = ?`,
    [error, userId]
  );
}

export interface McpApiKey {
  key_hash: string;
  user_id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Register a new MCP API key
 */
export async function createMcpApiKey(userId: number, keyHash: string, name: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO mcp_api_keys (key_hash, user_id, name) VALUES (?, ?, ?)`,
    [keyHash, userId, name]
  );
}

/**
 * List all active API keys for a user
 */
export async function listMcpApiKeys(userId: number): Promise<McpApiKey[]> {
  const db = await getDb();
  return db.all<McpApiKey[]>(
    `SELECT key_hash, user_id, name, created_at, last_used_at FROM mcp_api_keys WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Revoke an API key
 */
export async function revokeMcpApiKey(userId: number, keyHash: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `DELETE FROM mcp_api_keys WHERE user_id = ? AND key_hash = ?`,
    [userId, keyHash]
  );
}

/**
 * Resolve user ID from an API key hash
 */
export async function getUserIdByMcpApiKey(keyHash: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.get<{ user_id: number }>(
    `SELECT user_id FROM mcp_api_keys WHERE key_hash = ?`,
    [keyHash]
  );
  return row ? row.user_id : null;
}

/**
 * Update the last used timestamp on a key
 */
export async function updateMcpApiKeyLastUsed(keyHash: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE mcp_api_keys SET last_used_at = datetime('now') WHERE key_hash = ?`,
    [keyHash]
  );
}
