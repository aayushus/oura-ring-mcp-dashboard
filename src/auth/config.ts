import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import crypto from "node:crypto";

export function getCredentialsDir(): string {
  const containerDir = join(homedir(), ".oura-mcp");
  const localDir = join(process.cwd(), "oura_credentials");
  
  // If running in container or local host folder does not exist
  if (existsSync(containerDir)) {
    return containerDir;
  }
  
  // Fallback to local workspace folder
  return localDir;
}

let cachedSecret: string | null = null;

export function getAuthSecret(): string {
  if (cachedSecret) return cachedSecret;

  if (process.env.AUTH_SECRET) {
    cachedSecret = process.env.AUTH_SECRET;
    return cachedSecret;
  }

  const dir = getCredentialsDir();
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // Ignore error if directory creation fails or exists
  }

  const secretPath = join(dir, "auth_secret");
  if (existsSync(secretPath)) {
    cachedSecret = readFileSync(secretPath, "utf8").trim();
    return cachedSecret;
  }

  // Generate new secret
  const secret = crypto.randomBytes(32).toString("hex");
  try {
    writeFileSync(secretPath, secret, "utf8");
    console.log(`[Config] Generated new AUTH_SECRET and persisted to ${secretPath}`);
  } catch (err) {
    console.warn(`[Config] Failed to persist generated secret to disk:`, err);
  }
  
  cachedSecret = secret;
  return cachedSecret;
}
