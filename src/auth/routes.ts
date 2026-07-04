import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  createUser,
  getUserByEmail,
  createSession,
  getSession,
  deleteSession,
  addLoginAttempt,
  getRecentLoginAttemptsCount,
  countUsers,
  getOuraConnection,
  upsertOuraConnection,
  deleteOuraConnection,
  createMcpApiKey,
  listMcpApiKeys,
  revokeMcpApiKey,
} from "./db.js";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  requireAuth,
} from "./web.js";
import { getOuraCredentials } from "./settings.js";
import { encrypt, decrypt } from "./crypto.js";

const authRouter = express.Router();

function isLocalHost(req: Request): boolean {
  const host = req.get("host") || "";
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("0.0.0.0") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
}

/**
 * POST /api/auth/signup
 */
authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Missing required fields: name, email, password" });
      return;
    }

    const totalUsers = await countUsers();
    const signupsEnabled = process.env.ALLOW_SIGNUPS !== "false";

    // First run exception: allowed if no users exist
    if (!signupsEnabled && totalUsers > 0) {
      res.status(403).json({ error: "signups_disabled" });
      return;
    }

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    if (password.length < 10) {
      res.status(400).json({ error: "Password must be at least 10 characters long" });
      return;
    }

    // Check duplicate email
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: "Email address already registered" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const role = totalUsers === 0 ? "admin" : "member";

    const user = await createUser(name, email, passwordHash, role);

    // Create session
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    await createSession(tokenHash, user.id, expiresAt, req.headers["user-agent"] || null);

    res.cookie("halo_session", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isLocalHost(req) ? false : (req.secure || req.headers["x-forwarded-proto"] === "https"),
    });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[Auth] Signup error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Missing required fields: email, password" });
      return;
    }

    const emailStr = String(email).toLowerCase().trim();
    const attemptKey = `${req.ip}:${emailStr}`;
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 min

    // Rate limiting check
    const failures = await getRecentLoginAttemptsCount(attemptKey, cutoff);
    if (failures >= 10) {
      res.status(429).json({
        error: "Too many login attempts. Please try again in 15 minutes.",
      });
      return;
    }

    const user = await getUserByEmail(emailStr);

    if (!user) {
      await addLoginAttempt(attemptKey, new Date().toISOString());
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.disabled === 1) {
      res.status(401).json({ error: "Account is disabled" });
      return;
    }

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      await addLoginAttempt(attemptKey, new Date().toISOString());
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Create session
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    await createSession(tokenHash, user.id, expiresAt, req.headers["user-agent"] || null);

    res.cookie("halo_session", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isLocalHost(req) ? false : (req.secure || req.headers["x-forwarded-proto"] === "https"),
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.halo_session;
    if (token && typeof token === "string") {
      const tokenHash = hashSessionToken(token);
      await deleteSession(tokenHash);
    }
    
    res.clearCookie("halo_session", { path: "/" });
    res.status(204).end();
  } catch (err) {
    console.error("[Auth] Logout error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/me
 */
authRouter.get("/me", async (req: Request, res: Response) => {
  const token = req.cookies?.halo_session;
  const signupsEnabled = process.env.ALLOW_SIGNUPS !== "false";
  const totalUsers = await countUsers();
  const isFirstRun = totalUsers === 0;

  if (!token || typeof token !== "string") {
    res.status(401).json({
      error: "Unauthorized",
      flags: { signupsEnabled, isFirstRun, ouraAppConfigured: false, ouraConnected: false },
    });
    return;
  }

  try {
    const tokenHash = hashSessionToken(token);
    const sessionWithUser = await getSession(tokenHash);

    if (!sessionWithUser || sessionWithUser.user.disabled === 1 || new Date() > new Date(sessionWithUser.session.expires_at)) {
      res.status(401).json({
        error: "Unauthorized",
        flags: { signupsEnabled, isFirstRun, ouraAppConfigured: false, ouraConnected: false },
      });
      return;
    }

    const { user } = sessionWithUser;
    
    // Check Oura Client Configuration status
    const creds = await getOuraCredentials();
    const connection = await getOuraConnection(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      flags: {
        signupsEnabled,
        isFirstRun: false,
        ouraAppConfigured: !!creds.clientId && !!creds.clientSecret,
        ouraConnected: !!connection,
      },
    });
  } catch (err) {
    console.error("[Auth] me error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/auth/oura/connect
 * Generates Oura Authorization URL
 */
authRouter.get("/oura/connect", requireAuth, async (req: Request, res: Response) => {
  try {
    const creds = await getOuraCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      res.status(400).json({ error: "Oura Application Client ID and Secret are not configured." });
      return;
    }

    // Encrypt the state containing userId to verify callback
    const state = encrypt(JSON.stringify({ userId: req.user!.id, salt: randomUUID() }));
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/oura/callback`;

    const authUrl = `https://cloud.ouraring.com/oauth/authorize?` + new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "personal daily",
      state,
    });

    res.json({ url: authUrl });
  } catch (err) {
    console.error("[OAuth] Connect initiation error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/auth/oura/callback
 * Handles redirect from Oura OAuth
 */
authRouter.get("/oura/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).send(`<html><body><h2>Authorization failed</h2><p>${error}</p></body></html>`);
      return;
    }

    if (!code || !state || typeof code !== "string" || typeof state !== "string") {
      res.status(400).send("<html><body><h2>Invalid request: missing code or state</h2></body></html>");
      return;
    }

    // Decrypt state to get userId
    let userId: number;
    try {
      const decrypted = JSON.parse(decrypt(state));
      userId = decrypted.userId;
    } catch (err) {
      res.status(400).send("<html><body><h2>Invalid state parameter.</h2></body></html>");
      return;
    }

    const creds = await getOuraCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      res.status(400).send("<html><body><h2>Oura App Credentials are not configured.</h2></body></html>");
      return;
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/oura/callback`;

    // Exchange code for tokens
    const response = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.error || "Token exchange failed");
    }

    // Save connection to DB
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await upsertOuraConnection(userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: data.scope || null,
    });

    res.send(`
      <html>
        <head>
          <title>Connected successfully</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-align: center; padding: 50px; background: #0b0c10; color: #ffffff; }
            h2 { color: #b55fe6; }
          </style>
        </head>
        <body>
          <h2>Connection Successful!</h2>
          <p>Your Oura Ring account is now linked securely to your Halo profile.</p>
          <p>You can close this window now.</p>
          <script>
            try {
              window.opener.postMessage({ type: "oura_connected", success: true }, "*");
            } catch (e) {}
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("[OAuth] Callback error:", err);
    res.status(500).send(`<html><body><h2>Internal Server Error</h2><p>${err.message || err}</p></body></html>`);
  }
});

/**
 * DELETE /api/auth/oura/connection
 * Removes Oura link mapping for the authenticated user
 */
authRouter.delete("/oura/connection", requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteOuraConnection(req.user!.id);
    res.status(204).end();
  } catch (err) {
    console.error("[OAuth] Disconnect error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

import crypto from "node:crypto";

/**
 * GET /api/auth/mcp/keys
 * Lists all active MCP API keys for the authenticated user
 */
authRouter.get("/mcp/keys", requireAuth, async (req: Request, res: Response) => {
  try {
    const keys = await listMcpApiKeys(req.user!.id);
    res.json(keys.map(k => ({
      key_hash: k.key_hash,
      name: k.name,
      created_at: k.created_at,
      last_used_at: k.last_used_at
    })));
  } catch (err) {
    console.error("[MCP Keys] List error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/auth/mcp/keys
 * Generates a new MCP API key
 */
authRouter.post("/mcp/keys", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Key name is required." });
      return;
    }

    const token = "halo_" + crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(token).digest("hex");

    await createMcpApiKey(req.user!.id, keyHash, name);

    res.status(201).json({
      key: token,
      key_hash: keyHash,
      name,
    });
  } catch (err) {
    console.error("[MCP Keys] Create error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * DELETE /api/auth/mcp/keys/:hash
 * Revokes/deletes an MCP API key
 */
authRouter.delete("/mcp/keys/:hash", requireAuth, async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    await revokeMcpApiKey(req.user!.id, hash as string);
    res.status(204).end();
  } catch (err) {
    console.error("[MCP Keys] Delete error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export { authRouter };
