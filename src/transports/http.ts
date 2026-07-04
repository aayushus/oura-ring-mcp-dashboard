/**
 * HTTP Transport for Oura MCP Server
 *
 * Enables remote deployment via Streamable HTTP transport.
 * Authentication flow:
 *   1. OAuth 2.1 proxied through Oura (for Claude.ai connector)
 *   2. Static bearer token via MCP_SECRET (backward compat for Claude Desktop)
 *
 * OAuth endpoints (handled by MCP SDK's mcpAuthRouter):
 *   GET  /.well-known/oauth-authorization-server   — OAuth metadata discovery
 *   GET  /.well-known/oauth-protected-resource/mcp — Protected resource metadata
 *   POST /register                                  — Dynamic client registration
 *   GET  /authorize                                 — Redirects to Oura OAuth
 *   POST /token                                     — Token exchange
 *   POST /revoke                                    — Token revocation
 *
 * Custom route:
 *   GET  /oauth/callback — Handles Oura's redirect after user authorizes
 */
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  OuraMcpOAuthProvider,
  type OuraMcpOAuthProviderOptions,
} from "../auth/mcp-oauth-provider.js";
import { OuraClient } from "../client.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getSetting, setSetting, getOuraCredentials } from "../auth/settings.js";
import { requestContextStorage } from "../auth/context.js";
import cookieParser from "cookie-parser";
import { authRouter } from "../auth/routes.js";
import { requireAuth, requireAdmin, csrfGuard } from "../auth/web.js";
import { getOuraConnection, getUserIdByMcpApiKey, updateMcpApiKeyLastUsed } from "../auth/db.js";
import {
  getDb,
  getHistory,
  getUserProfile,
  getUserTargets,
  getTargetHistory,
  upsertUserProfile,
  getRawDocuments,
  getExperiments,
  getExperimentDays,
  upsertExperiment,
  upsertExperimentDay,
  getAnomalies,
  upsertAnomaly,
  getAlertPreferences,
  setAlertMute,
  getSyncLog,
} from "../db.js";
import { syncData, startSyncScheduler, getActiveSyncJob, isSyncRunning } from "../sync.js";
import { getToday, getDaysAgo } from "../utils/index.js";
import { runWeeklyTargetJob } from "../utils/targets.js";
import {
  calculateSleepDebt,
  calculateACWR,
  detectBiometricAnomalies,
  calculatePearsonCorrelations,
  calculateTagEffects,
} from "../utils/analysis/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface HttpTransportOptions {
  /** Port to listen on (default: process.env.PORT || 3000) */
  port?: number;
  /** Secret for bearer token auth (backward compat with MCP_SECRET) */
  secret?: string;
  /** Enable stateless mode for horizontal scaling (default: true) */
  stateless?: boolean;
  /** OuraClient instance to update when OAuth tokens are obtained */
  ouraClient?: OuraClient;
}

// ─────────────────────────────────────────────────────────────
// Base URL Resolution
// ─────────────────────────────────────────────────────────────

function resolveBaseUrl(port: number): URL {
  if (process.env.BASE_URL) {
    return new URL(process.env.BASE_URL);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  return new URL(`http://localhost:${port}`);
}

// ─────────────────────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────────────────────

export async function startHttpServer(
  server: McpServer,
  options: HttpTransportOptions = {}
): Promise<void> {
  const port = options.port ?? parseInt(process.env.PORT || "3000", 10);
  const secret = options.secret ?? process.env.MCP_SECRET;
  const stateless = options.stateless ?? true;
  const ouraClient = options.ouraClient;

  if (ouraClient) {
    startSyncScheduler(ouraClient);
  }

  const baseUrl = resolveBaseUrl(port);

  // Check for Oura OAuth credentials
  const ouraClientId = process.env.OURA_CLIENT_ID;
  const ouraClientSecret = process.env.OURA_CLIENT_SECRET;
  const hasOuraOAuth = !!(ouraClientId && ouraClientSecret);

  if (!hasOuraOAuth && !secret) {
    console.error(
      "WARNING: No authentication configured!\n" +
        "Set OURA_CLIENT_ID + OURA_CLIENT_SECRET for OAuth, or MCP_SECRET for static auth."
    );
  }

  let bearerAuth: express.RequestHandler | null = null;

  const customBearerAuth = async (req: Request, res: Response, next: express.NextFunction) => {
    if (req.path === "/health" || req.path === "/healthz") return next();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ error: "Invalid Authorization scheme" });
      return;
    }

    // 1. Static/legacy secret fallback
    if (secret && token === secret) {
      req.user = { id: 1, role: "admin" } as any;
      return next();
    }

    // 2. Custom multi-user MCP API keys
    if (token.startsWith("halo_")) {
      const crypto = await import("node:crypto");
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const userId = await getUserIdByMcpApiKey(hash);
      if (userId) {
        updateMcpApiKeyLastUsed(hash).catch(err => console.error("Failed to update last used:", err));
        req.user = { id: userId, role: "member" } as any;
        return next();
      }
    }

    // 3. Oura OAuth token verification fallback
    if (bearerAuth) {
      return bearerAuth(req, res, next);
    }

    res.status(401).json({ error: "Invalid credentials" });
  };

  const app = express();

  // Trust Railway's load balancer (fixes X-Forwarded-For rate limit errors)
  app.set("trust proxy", 1);

  // Parse JSON bodies
  app.use(express.json());

  // Parse cookies for session auth
  app.use(cookieParser());

  // Mount Authentication endpoints
  app.use("/api/auth", authRouter);
  app.get("/api/me", authRouter); // Also route GET /api/me to the authRouter

  // Protect all dashboard API endpoints
  app.use("/api/dashboard", requireAuth, csrfGuard);

  // CORS for remote clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Health check endpoint (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "oura-mcp" });
  });

  // ── Oura Health Dashboard API Routes ──────────────────────

  // Get health summary history (last 30 days) with advanced analytics
  app.get("/api/dashboard/summary", async (req: Request, res: Response) => {
    try {
      const endDay = (req.query.day as string) || undefined;
      const userId = req.user?.id ?? 1;
      let history = await getHistory(365, endDay, userId); // fetch 365 days to support year-view heatmaps, ACWR, and sleep debt properly

      // Auto-sync if DB is empty and client is available
      const isEmpty = history.sleep.length === 0 && history.readiness.length === 0;
      if (isEmpty && ouraClient) {
        console.error("[HTTP] Database empty, triggering auto-sync...");
        const syncResult = await syncData(ouraClient, getDaysAgo(30), getToday(), "auto", userId);
        if (syncResult.success) {
          history = await getHistory(365, undefined, userId);
        }
      }

      // Calculate sleep need and step targets
      const targets = await getUserTargets(userId);
      const sleepNeed = targets?.sleep_need_seconds ?? 27900; // default 7.75h

      const sleepDebt = calculateSleepDebt(history.sleep, sleepNeed);
      const acwr = calculateACWR(history.activity);
      const computedAnomalies = detectBiometricAnomalies(history.readiness);

      // Save computed anomalies to database
      for (const anomaly of computedAnomalies) {
        await upsertAnomaly(anomaly, userId);
      }

      // Fetch raw endpoints from database
      const rawTags = await getRawDocuments("enhanced_tag", undefined, undefined, userId);
      const rawSleep = await getRawDocuments("daily_sleep", undefined, undefined, userId);
      const rawWorkouts = await getRawDocuments("workout", undefined, undefined, userId);
      const rawCardioAge = await getRawDocuments("daily_cardiovascular_age", undefined, undefined, userId);
      const rawVo2Max = await getRawDocuments("vO2_max", undefined, undefined, userId);
      const rawResilience = await getRawDocuments("daily_resilience", undefined, undefined, userId);

      const tagEffects = calculateTagEffects(rawTags, history.sleep, history.readiness);
      const correlations = calculatePearsonCorrelations(history.sleep, history.readiness, history.activity);

      // Early warning illness calculation
      const latestRead = history.readiness[history.readiness.length - 1];
      const rhrWindow = history.readiness.slice(-30).map((r) => r.rhr);
      const hrvWindow = history.readiness.slice(-30).map((r) => r.hrv);
      const rhrBaseline = rhrWindow.length > 0 ? rhrWindow.reduce((a, b) => a + b, 0) / rhrWindow.length : 60;
      const hrvBaseline = hrvWindow.length > 0 ? hrvWindow.reduce((a, b) => a + b, 0) / hrvWindow.length : 50;

      let illnessWarning = false;
      if (latestRead) {
        if (
          latestRead.temperature_deviation >= 0.5 ||
          latestRead.rhr > 1.2 * rhrBaseline ||
          latestRead.hrv < 0.7 * hrvBaseline
        ) {
          illnessWarning = true;
        }
      }

      // Worst contributor extraction
      const latestRawSleep = rawSleep[rawSleep.length - 1];
      const latestRawReadiness = (await getRawDocuments("daily_readiness", undefined, undefined, userId)).slice(-1)[0] || null;

      let worstContributor = null;
      let worstScore = 100;

      if (latestRawSleep && latestRawSleep.contributors) {
        for (const [name, val] of Object.entries(latestRawSleep.contributors)) {
          if (typeof val === "number" && val < worstScore) {
            worstScore = val;
            worstContributor = { source: "Sleep", name: name.replace(/_/g, " "), score: val };
          }
        }
      }

      if (latestRawReadiness && latestRawReadiness.contributors) {
        for (const [name, val] of Object.entries(latestRawReadiness.contributors)) {
          if (typeof val === "number" && val < worstScore) {
            worstScore = val;
            worstContributor = { source: "Readiness", name: name.replace(/_/g, " "), score: val };
          }
        }
      }

      res.json({
        sleep: history.sleep,
        sleepCompare: history.sleep.slice(-60, -30),
        readiness: history.readiness,
        readinessCompare: history.readiness.slice(-60, -30),
        activity: history.activity,
        activityCompare: history.activity.slice(-60, -30),
        stress: history.stress,
        sleepDebt: sleepDebt.slice(-30),
        acwr: acwr.slice(-30),
        anomalies: computedAnomalies.slice(0, 30),
        illnessWarning,
        tagEffects,
        correlations,
        rawSleep: rawSleep.slice(-10),
        rawReadiness: (await getRawDocuments("daily_readiness", undefined, undefined, userId)).slice(-10),
        workouts: rawWorkouts.slice(-20),
        cardioAge: rawCardioAge.slice(-30),
        vo2Max: rawVo2Max.slice(-30),
        resilience: rawResilience.slice(-30),
        worstContributor,
        rawActivity: (await getRawDocuments("daily_activity", undefined, undefined, userId)).slice(-10),
        targets,
        profile: await getUserProfile(userId),
        alertPreferences: await getAlertPreferences(userId),
        flags: {
          signupsEnabled: process.env.ALLOW_SIGNUPS !== "false",
          isFirstRun: false,
          ouraAppConfigured: !!(await getOuraCredentials()).clientId && !!(await getOuraCredentials()).clientSecret,
          ouraConnected: !!(await getOuraConnection(userId)),
        },
      });
    } catch (err) {
      console.error("Dashboard summary API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get anomaly alerts log list
  app.get("/api/dashboard/anomalies", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const records = await getAnomalies(50, userId);
      res.json(records);
    } catch (err) {
      console.error("Get anomalies list API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get active self-experiments list
  app.get("/api/dashboard/experiments", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const exps = await getExperiments(userId);
      const enriched = await Promise.all(
        exps.map(async (exp) => {
          const loggedDays = await getExperimentDays(exp.id, userId);
          return {
            ...exp,
            metric_ids: JSON.parse(exp.metric_ids),
            loggedDays,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      console.error("Get self experiments list API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Register new self-experiment config
  app.post("/api/dashboard/experiments", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const {
        title,
        behavior_text,
        metric_ids,
        direction_hypothesis,
        start_date,
        duration_days,
        confounder_warning,
      } = req.body;

      if (!title || !behavior_text || !start_date) {
        res.status(400).json({ error: "Missing required experiment parameters" });
        return;
      }

      const id = `exp-${Date.now()}`;
      const exp = {
        id,
        title,
        behavior_text,
        metric_ids: JSON.stringify(metric_ids || []),
        direction_hypothesis: direction_hypothesis || "improve",
        start_date,
        duration_days: Number(duration_days || 14),
        status: "active",
        confounder_warning: confounder_warning || "",
      };

      await upsertExperiment(exp, userId);
      res.json({
        ...exp,
        metric_ids: metric_ids || [],
        loggedDays: [],
      });
    } catch (err) {
      console.error("Create self experiment API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Log adherence compliance status for a specific day
  app.post("/api/dashboard/experiments/:id/log", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const id = req.params.id as string;
      const { day, adherent } = req.body;

      if (!day || adherent === undefined) {
        res.status(400).json({ error: "Missing day or adherence status parameters" });
        return;
      }

      await upsertExperimentDay({
        experiment_id: id,
        day,
        adherent: Number(adherent),
      }, userId);

      res.json({ success: true });
    } catch (err) {
      console.error("Log experiment day API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Manually trigger sync from dashboard UI
  app.post("/api/dashboard/sync", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      if (!ouraClient) {
        res.status(400).json({ error: "Oura client not initialized" });
        return;
      }
      if (isSyncRunning()) {
        res.status(409).json({ error: "A sync is already running" });
        return;
      }

      const syncResult = await syncData(ouraClient, getDaysAgo(365), getToday(), "manual", userId);
      if (!syncResult.success) {
        res.status(500).json({ error: syncResult.error || "Sync failed", summary: syncResult });
        return;
      }

      const history = await getHistory(30, undefined, userId);
      res.json({ success: true, history, summary: syncResult });
    } catch (err) {
      console.error("Dashboard sync API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Live state of the current (or most recent) sync run — polled by the sync drawer
  app.get("/api/dashboard/sync/status", (_req: Request, res: Response) => {
    res.json({ running: isSyncRunning(), job: getActiveSyncJob() });
  });

  // Persisted history of past sync runs
  app.get("/api/dashboard/sync/log", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
      res.json(await getSyncLog(limit, userId));
    } catch (err) {
      console.error("Sync log API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Export full historical biometrics in JSON or CSV format
  // Export full historical biometrics in JSON or CSV format
  app.get("/api/dashboard/export", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const history = await getHistory(1000, undefined, userId);
      const anomalies = await getAnomalies(100, userId);
      const targetHistory = await getTargetHistory(undefined, userId);
      const format = req.query.format === "csv" ? "csv" : "json";

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=oura_dashboard_export.json");
        res.json({ history, anomalies, targetHistory });
      } else {
        let csv = "date,metric,value\n";
        history.sleep.forEach((r) => {
          csv += `${r.day},sleep_score,${r.score}\n`;
        });
        history.readiness.forEach((r) => {
          csv += `${r.day},readiness_score,${r.score}\n`;
        });
        history.activity.forEach((r) => {
          csv += `${r.day},activity_score,${r.score}\n`;
        });
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=oura_dashboard_export.csv");
        res.send(csv);
      }
    } catch (err) {
      console.error("Dashboard export API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get raw details for unified day-strip stacked timeline
  app.get("/api/dashboard/daystrip", async (req: Request, res: Response) => {
    try {
      const day = (req.query.day as string) || getToday();
      const userId = req.user?.id ?? 1;
      
      // Calculate D-1
      const date = new Date(day + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() - 1);
      const prevDay = date.toISOString().slice(0, 10);

      // Fetch raw datasets
      const sleepDocs = await getRawDocuments("sleep", prevDay, day, userId);
      const activityDocs = await getRawDocuments("daily_activity", prevDay, day, userId);
      const heartrateDocs = await getRawDocuments("heartrate", prevDay, day, userId);
      const workoutDocs = await getRawDocuments("workout", prevDay, day, userId);
      const sessionDocs = await getRawDocuments("session", prevDay, day, userId);
      
      res.json({
        day,
        prevDay,
        sleep: sleepDocs,
        activity: activityDocs,
        heartrate: heartrateDocs,
        workouts: workoutDocs,
        sessions: sessionDocs,
      });
    } catch (err) {
      console.error("Daystrip API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get weekly narrative summary
  app.get("/api/dashboard/weekly", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const history = await getHistory(14, undefined, userId); // Fetch 14 days
      const sleep = history.sleep;
      const readiness = history.readiness;
      const activity = history.activity;

      // Split into last 7 days and prior 7 days
      const currentSleep = sleep.slice(-7);
      const priorSleep = sleep.slice(-14, -7);

      const currentReadiness = readiness.slice(-7);
      const priorReadiness = readiness.slice(-14, -7);

      const currentActivity = activity.slice(-7);
      const priorActivity = activity.slice(-14, -7);

      const avg = (arr: any[]) => arr.length > 0 ? arr.reduce((sum, r) => sum + r.score, 0) / arr.length : null;

      const avgSleepCurr = avg(currentSleep);
      const avgSleepPrior = avg(priorSleep);

      const avgReadinessCurr = avg(currentReadiness);
      const avgReadinessPrior = avg(priorReadiness);

      const avgActivityCurr = avg(currentActivity);
      const avgActivityPrior = avg(priorActivity);

      const deltas = {
        sleep: avgSleepCurr !== null && avgSleepPrior !== null ? avgSleepCurr - avgSleepPrior : 0,
        readiness: avgReadinessCurr !== null && avgReadinessPrior !== null ? avgReadinessCurr - avgReadinessPrior : 0,
        activity: avgActivityCurr !== null && avgActivityPrior !== null ? avgActivityCurr - avgActivityPrior : 0,
      };

      // Biggest win & watch out
      let biggestWin = "Recovery consistency";
      let winDelta = 0;
      let watchOut = "Activity patterns";
      let watchOutDelta = 100;

      const candidates = [
        { name: "Sleep Quality", delta: deltas.sleep },
        { name: "Readiness Recovery", delta: deltas.readiness },
        { name: "Activity Consistency", delta: deltas.activity }
      ];

      candidates.forEach(c => {
        if (c.delta > winDelta) {
          winDelta = c.delta;
          biggestWin = c.name;
        }
        if (c.delta < watchOutDelta) {
          watchOutDelta = c.delta;
          watchOut = c.name;
        }
      });

      // Calculate Sleep Streak (consecutive days >= 75)
      let streak = 0;
      let maxStreak = 0;
      sleep.forEach(r => {
        if (r.score >= 75) {
          streak++;
          if (streak > maxStreak) maxStreak = streak;
        } else {
          streak = 0;
        }
      });

      res.json({
        sleepAvg: avgSleepCurr !== null ? Math.round(avgSleepCurr) : null,
        sleepDelta: deltas.sleep.toFixed(1),
        readinessAvg: avgReadinessCurr !== null ? Math.round(avgReadinessCurr) : null,
        readinessDelta: deltas.readiness.toFixed(1),
        activityAvg: avgActivityCurr !== null ? Math.round(avgActivityCurr) : null,
        activityDelta: deltas.activity.toFixed(1),
        biggestWin,
        watchOut,
        sleepStreak: maxStreak,
      });
    } catch (err) {
      console.error("Weekly narrative API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get alert preferences
  app.get("/api/dashboard/alerts/prefs", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const prefs = await getAlertPreferences(userId);
      res.json(prefs);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Mute an alert
  app.post("/api/dashboard/alerts/mute", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const { alert_type, muted } = req.body;
      await setAlertMute(alert_type, muted ? 1 : 0, userId);
      res.json({ success: true, alert_type, muted });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get App Settings (Oura Client Configuration status)
  app.get("/api/dashboard/settings", async (_req: Request, res: Response) => {
    try {
      const clientId = await getSetting("oura_client_id");
      const clientSecret = await getSetting("oura_client_secret");
      res.json({
        oura_client_id: clientId || "",
        oura_client_secret_configured: !!clientSecret,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Save App Settings
  app.post("/api/dashboard/settings", async (req: Request, res: Response) => {
    try {
      const { oura_client_id, oura_client_secret } = req.body;
      const userId = req.user?.id ?? 1;

      if (oura_client_id !== undefined) {
        await setSetting("oura_client_id", oura_client_id, userId);
      }
      if (oura_client_secret) {
        await setSetting("oura_client_secret", oura_client_secret, userId);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get all users (Admin Only)
  app.get("/api/dashboard/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const users = await db.all("SELECT id, name, email, role, disabled, created_at FROM users ORDER BY id ASC");
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Toggle user disabled status (Admin Only)
  app.post("/api/dashboard/users/:id/toggle-disabled", requireAdmin, async (req: Request, res: Response) => {
    try {
      const targetId = Number(req.params.id);
      if (req.user && targetId === req.user.id) {
        res.status(400).json({ error: "Cannot disable your own administrator account" });
        return;
      }
      const db = await getDb();
      const user = await db.get("SELECT disabled FROM users WHERE id = ?", [targetId]);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const newStatus = user.disabled === 1 ? 0 : 1;
      await db.run("UPDATE users SET disabled = ? WHERE id = ?", [newStatus, targetId]);
      res.json({ success: true, disabled: newStatus });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get user profile, targets, and targets changelog history
  app.get("/api/dashboard/targets", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const profile = await getUserProfile(userId);
      const targets = await getUserTargets(userId);
      const history = await getTargetHistory(undefined, userId);
      res.json({ profile, targets, history });
    } catch (err) {
      console.error("Get dashboard targets API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Save onboarding profile data and trigger initial targets calculation
  app.post("/api/dashboard/onboarding", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? 1;
      const {
        age,
        weight_kg,
        height_cm,
        biological_sex,
        target_wake_time,
        goal,
        training_days,
      } = req.body;

      if (
        age === undefined ||
        weight_kg === undefined ||
        height_cm === undefined ||
        !biological_sex ||
        !target_wake_time ||
        !goal ||
        training_days === undefined
      ) {
        res.status(400).json({ error: "Missing required onboarding fields" });
        return;
      }

      // Upsert profile
      await upsertUserProfile({
        age: Number(age),
        weight_kg: Number(weight_kg),
        height_cm: Number(height_cm),
        biological_sex,
        target_wake_time,
        goal,
        training_days: Number(training_days),
      }, userId);

      // Run weekly targets calculation job immediately
      await runWeeklyTargetJob(userId);

      const profile = await getUserProfile(userId);
      const targets = await getUserTargets(userId);
      const history = await getTargetHistory(undefined, userId);

      res.json({ profile, targets, history });
    } catch (err) {
      console.error("Onboarding API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Serve dashboard static files whether OAuth is configured or not
  const publicPath = join(__dirname, "..", "public");
  app.use("/dashboard", express.static(publicPath));
  app.get("/dashboard/{*splat}", (_req: Request, res: Response) => {
    res.sendFile(join(publicPath, "index.html"));
  });

  // ── OAuth Setup ──────────────────────────────────────────

  if (!hasOuraOAuth) {
    // No Oura OAuth credentials — fall back to static MCP_SECRET only
    console.error(
      "Oura OAuth not configured (missing OURA_CLIENT_ID/OURA_CLIENT_SECRET).\n" +
        "Claude.ai connector will not work. Use MCP_SECRET for Claude Desktop."
    );

    app.use((req, res, next) => {
      if (req.path === "/" || req.path === "/mcp") {
        return customBearerAuth(req, res, next);
      }
      next();
    });

    app.use(async (req, res, next) => {
      if (req.path === "/" || req.path === "/mcp") {
        const userId = req.user?.id ?? 1;
        let userClient = ouraClient;
        try {
          const conn = await getOuraConnection(userId);
          if (conn) {
            userClient = new OuraClient({ accessToken: conn.access_token });
          }
        } catch (e) {}
        return requestContextStorage.run({ userId, ouraClient: userClient }, () => {
          next();
        });
      }
      next();
    });
    console.error("Static bearer token and custom API key authentication enabled");
  } else {
    // Oura OAuth configured — set up full OAuth 2.1 flow
    const providerOptions: OuraMcpOAuthProviderOptions = {
      baseUrl,
      ouraClientId: ouraClientId!,
      ouraClientSecret: ouraClientSecret!,
      staticSecret: secret,
      onOuraTokens: (accessToken, _refreshToken) => {
        if (ouraClient) {
          ouraClient.setAccessToken(accessToken);
          console.error("OuraClient updated with new OAuth token");
        }
      },
    };

    const oauthProvider = new OuraMcpOAuthProvider(providerOptions);

    // Mount OAuth endpoints (metadata, authorize, token, register, revoke)
    // resourceServerUrl is set to baseUrl (root) so Claude.ai can find
    // protected resource metadata at /.well-known/oauth-protected-resource
    app.use(
      mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl: baseUrl,
        baseUrl: baseUrl,
        resourceServerUrl: baseUrl,
        resourceName: "Oura MCP Server",
        scopesSupported: [],
      })
    );

    // Oura OAuth callback — handles redirect from Oura after user authorizes
    app.get("/oauth/callback", async (req: Request, res: Response) => {
      try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const error = req.query.error as string;

        if (error) {
          const description = req.query.error_description as string;
          res.status(400).send(
            `<html><body>
              <h2>Authorization failed</h2>
              <p>${description || error}</p>
              <p>You can close this window.</p>
            </body></html>`
          );
          return;
        }

        if (!code || !state) {
          res.status(400).json({ error: "Missing code or state parameter" });
          return;
        }

        // Exchange Oura code and redirect to MCP client
        const redirectUrl = await oauthProvider.handleOuraCallback(code, state);
        res.redirect(302, redirectUrl);
      } catch (err) {
        console.error("OAuth callback error:", err);
        res.status(500).send(
          `<html><body>
            <h2>Authorization error</h2>
            <p>${err instanceof Error ? err.message : String(err)}</p>
            <p>Please try again.</p>
          </body></html>`
        );
      }
    });

    // Protect MCP endpoint with bearer auth
    bearerAuth = requireBearerAuth({ verifier: oauthProvider });

    // ── MCP Endpoint ─────────────────────────────────────────

    const transports = new Map<string, StreamableHTTPServerTransport>();

    // MCP endpoint at root (/) for Claude.ai compatibility
    // Also handle /mcp for backward compatibility with existing configs
    const mcpHandler = async (req: Request, res: Response) => {
      console.error(`[MCP] ${req.method} ${req.path} request received`);
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (stateless) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await server.connect(transport);
        } else {
          if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId)!;
          } else {
            const newSessionId = randomUUID();
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => newSessionId,
            });
            await server.connect(transport);
            transports.set(newSessionId, transport);
            transport.onclose = () => {
              transports.delete(newSessionId);
            };
          }
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("MCP request error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    const mcpDeleteHandler = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        res.status(200).json({ message: "Session closed" });
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    };

    const injectContext = async (req: Request, res: Response, next: express.NextFunction) => {
      const userId = req.user?.id ?? 1;
      let userClient = ouraClient;
      try {
        const conn = await getOuraConnection(userId);
        if (conn) {
          userClient = new OuraClient({ accessToken: conn.access_token });
        }
      } catch (e) {
        console.error("[Context] Failed to load user Oura client:", e);
      }

      requestContextStorage.run({ userId, ouraClient: userClient }, () => {
        next();
      });
    };

    // Mount MCP handlers at both / and /mcp for compatibility
    app.post("/", customBearerAuth, injectContext, mcpHandler);
    app.get("/", customBearerAuth, injectContext, mcpHandler);
    app.delete("/", customBearerAuth, injectContext, mcpDeleteHandler);
    app.post("/mcp", customBearerAuth, injectContext, mcpHandler);
    app.get("/mcp", customBearerAuth, injectContext, mcpHandler);
    app.delete("/mcp", customBearerAuth, injectContext, mcpDeleteHandler);

    console.error("OAuth 2.1 authentication enabled (Oura proxy)");
    if (secret) {
      console.error("Static MCP_SECRET also accepted as bearer token");
    }
  }

  // If no OAuth setup, still need the MCP endpoint (with simple auth or none)
  if (!hasOuraOAuth) {
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const mcpHandler = async (req: Request, res: Response) => {
      console.error(`[MCP] ${req.method} ${req.path} request received`);
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (stateless) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await server.connect(transport);
        } else {
          if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId)!;
          } else {
            const newSessionId = randomUUID();
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => newSessionId,
            });
            await server.connect(transport);
            transports.set(newSessionId, transport);
            transport.onclose = () => {
              transports.delete(newSessionId);
            };
          }
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("MCP request error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    const mcpDeleteHandler = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        res.status(200).json({ message: "Session closed" });
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    };

    // Mount MCP handlers at both / and /mcp for compatibility
    app.post("/", mcpHandler);
    app.get("/", mcpHandler);
    app.delete("/", mcpDeleteHandler);
    app.post("/mcp", mcpHandler);
    app.get("/mcp", mcpHandler);
    app.delete("/mcp", mcpDeleteHandler);
  }

  // Start listening
  app.listen(port, "0.0.0.0", () => {
    console.error(`Oura MCP server running on http://0.0.0.0:${port}`);
    console.error(`Public URL: ${baseUrl.href}`);
    console.error(`MCP endpoint: POST ${baseUrl.href} (or ${baseUrl.href}mcp)`);
    console.error(`Health check: GET /health`);
    if (hasOuraOAuth) {
      console.error(
        `OAuth metadata: GET /.well-known/oauth-authorization-server`
      );
      console.error(`Oura callback: GET /oauth/callback`);
    }
  });
}
