import { Request, Response, NextFunction } from "express";
import { hash, verify } from "@node-rs/argon2";
import crypto from "node:crypto";
import { getAuthSecret } from "./config.js";
import { getSession, updateSessionLastSeen, deleteSession, User } from "./db.js";

// Extend Express Request interface to hold user property
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  // Memory: 19MB (19456), Iterations: 2, Parallelism: 1
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
  });
}

/**
 * Verify a password using Argon2id
 */
export async function verifyPassword(passwordHash: string, plaintext: string): Promise<boolean> {
  return verify(passwordHash, plaintext);
}

/**
 * Generate a random session token (32 bytes converted to hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a session token using SHA-256
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Middleware: requireAuth
 * Authenticates the user using a session cookie
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.halo_session;
  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Unauthorized: Missing session cookie" });
    return;
  }

  try {
    const tokenHash = hashSessionToken(token);
    const sessionWithUser = await getSession(tokenHash);

    if (!sessionWithUser) {
      res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
      return;
    }

    const { session, user } = sessionWithUser;

    // Check user disabled status
    if (user.disabled === 1) {
      // Clear invalid session
      await deleteSession(tokenHash);
      res.clearCookie("halo_session", { path: "/" });
      res.status(401).json({ error: "Unauthorized: Account is disabled" });
      return;
    }

    // Check session expiry
    const now = new Date();
    const expiry = new Date(session.expires_at);
    if (now > expiry) {
      await deleteSession(tokenHash);
      res.clearCookie("halo_session", { path: "/" });
      res.status(401).json({ error: "Unauthorized: Session expired" });
      return;
    }

    // Attach user to Request object
    req.user = user;

    // Rolling session extension: if last_seen was > 24 hours ago, update last_seen and extend expiry
    const lastSeenStr = session.last_seen;
    const lastSeen = lastSeenStr ? new Date(lastSeenStr) : null;
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (!lastSeen || lastSeen < oneDayAgo) {
      const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Extend 30 days
      // Update session last_seen in background
      updateSessionLastSeen(tokenHash, now.toISOString()).catch(() => {});
    }

    next();
  } catch (err) {
    console.error("[Auth] requireAuth error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * Middleware: requireAdmin
 * Enforces admin role check
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized: Authenticated session required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }

  next();
}

/**
 * Middleware: csrfGuard
 * Protects mutating routes against CSRF using the X-Requested-With header check
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  const method = req.method;
  const isMutating = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  if (isMutating) {
    const header = req.headers["x-requested-with"];
    if (header !== "fetch") {
      res.status(403).json({ error: "Forbidden: CSRF protection triggered" });
      return;
    }
  }

  next();
}
