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
import type { OuraClient } from "../client.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
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
} from "../db.js";
import { syncData, startSyncScheduler } from "../sync.js";
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

  const app = express();

  // Trust Railway's load balancer (fixes X-Forwarded-For rate limit errors)
  app.set("trust proxy", 1);

  // Parse JSON bodies
  app.use(express.json());

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
      let history = await getHistory(60, endDay); // fetch 60 days to compute ACWR and sleep debt properly

      // Auto-sync if DB is empty and client is available
      const isEmpty = history.sleep.length === 0 && history.readiness.length === 0;
      if (isEmpty && ouraClient) {
        console.error("[HTTP] Database empty, triggering auto-sync...");
        const syncResult = await syncData(ouraClient, getDaysAgo(30), getToday());
        if (syncResult.success) {
          history = await getHistory(60);
        }
      }

      // Calculate sleep need and step targets
      const targets = await getUserTargets();
      const sleepNeed = targets?.sleep_need_seconds ?? 27900; // default 7.75h

      const sleepDebt = calculateSleepDebt(history.sleep, sleepNeed);
      const acwr = calculateACWR(history.activity);
      const computedAnomalies = detectBiometricAnomalies(history.readiness);

      // Save computed anomalies to database
      for (const anomaly of computedAnomalies) {
        await upsertAnomaly(anomaly);
      }

      // Fetch raw endpoints from database
      const rawTags = await getRawDocuments("enhanced_tag");
      const rawSleep = await getRawDocuments("daily_sleep");
      const rawWorkouts = await getRawDocuments("workout");
      const rawCardioAge = await getRawDocuments("daily_cardiovascular_age");
      const rawVo2Max = await getRawDocuments("vO2_max");
      const rawResilience = await getRawDocuments("daily_resilience");

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
      const latestRawReadiness = (await getRawDocuments("daily_readiness")).slice(-1)[0] || null;

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
        sleep: history.sleep.slice(-30),
        sleepCompare: history.sleep.slice(-60, -30),
        readiness: history.readiness.slice(-30),
        readinessCompare: history.readiness.slice(-60, -30),
        activity: history.activity.slice(-30),
        activityCompare: history.activity.slice(-60, -30),
        stress: history.stress.slice(-30),
        sleepDebt: sleepDebt.slice(-30),
        acwr: acwr.slice(-30),
        anomalies: computedAnomalies.slice(0, 30),
        illnessWarning,
        tagEffects,
        correlations,
        rawSleep: rawSleep.slice(-10),
        rawReadiness: (await getRawDocuments("daily_readiness")).slice(-10),
        workouts: rawWorkouts.slice(-20),
        cardioAge: rawCardioAge.slice(-30),
        vo2Max: rawVo2Max.slice(-30),
        resilience: rawResilience.slice(-30),
        worstContributor,
        rawActivity: (await getRawDocuments("daily_activity")).slice(-10),
        targets,
        profile: await getUserProfile(),
        alertPreferences: await getAlertPreferences(),
      });
    } catch (err) {
      console.error("Dashboard summary API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get anomaly alerts log list
  app.get("/api/dashboard/anomalies", async (_req: Request, res: Response) => {
    try {
      const records = await getAnomalies(50);
      res.json(records);
    } catch (err) {
      console.error("Get anomalies list API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get active self-experiments list
  app.get("/api/dashboard/experiments", async (_req: Request, res: Response) => {
    try {
      const exps = await getExperiments();
      const enriched = await Promise.all(
        exps.map(async (exp) => {
          const loggedDays = await getExperimentDays(exp.id);
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

      await upsertExperiment(exp);
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
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Log experiment day API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Manually trigger sync from dashboard UI
  app.post("/api/dashboard/sync", async (_req: Request, res: Response) => {
    try {
      if (!ouraClient) {
        res.status(400).json({ error: "Oura client not initialized" });
        return;
      }

      const syncResult = await syncData(ouraClient, getDaysAgo(7), getToday());
      if (!syncResult.success) {
        res.status(500).json({ error: syncResult.error || "Sync failed" });
        return;
      }

      const history = await getHistory(30);
      res.json({ success: true, history });
    } catch (err) {
      console.error("Dashboard sync API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Export full historical biometrics in JSON or CSV format
  app.get("/api/dashboard/export", async (req: Request, res: Response) => {
    try {
      const history = await getHistory(1000);
      const anomalies = await getAnomalies();
      const targetHistory = await getTargetHistory();
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
      
      // Calculate D-1
      const date = new Date(day + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() - 1);
      const prevDay = date.toISOString().slice(0, 10);

      // Fetch raw datasets
      const sleepDocs = await getRawDocuments("sleep", prevDay, day);
      const activityDocs = await getRawDocuments("daily_activity", prevDay, day);
      const heartrateDocs = await getRawDocuments("heartrate", prevDay, day);
      const workoutDocs = await getRawDocuments("workout", prevDay, day);
      const sessionDocs = await getRawDocuments("session", prevDay, day);
      
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
  app.get("/api/dashboard/weekly", async (_req: Request, res: Response) => {
    try {
      const history = await getHistory(14); // Fetch 14 days
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
  app.get("/api/dashboard/alerts/prefs", async (_req: Request, res: Response) => {
    try {
      const prefs = await getAlertPreferences();
      res.json(prefs);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Mute an alert
  app.post("/api/dashboard/alerts/mute", async (req: Request, res: Response) => {
    try {
      const { alert_type, muted } = req.body;
      await setAlertMute(alert_type, muted ? 1 : 0);
      res.json({ success: true, alert_type, muted });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get user profile, targets, and targets changelog history
  app.get("/api/dashboard/targets", async (_req: Request, res: Response) => {
    try {
      const profile = await getUserProfile();
      const targets = await getUserTargets();
      const history = await getTargetHistory();
      res.json({ profile, targets, history });
    } catch (err) {
      console.error("Get dashboard targets API error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Save onboarding profile data and trigger initial targets calculation
  app.post("/api/dashboard/onboarding", async (req: Request, res: Response) => {
    try {
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
      });

      // Run weekly targets calculation job immediately
      await runWeeklyTargetJob();

      const profile = await getUserProfile();
      const targets = await getUserTargets();
      const history = await getTargetHistory();

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

    if (secret) {
      // Simple bearer token auth (legacy)
      app.use((req, res, next) => {
        if (req.path === "/health") return next();
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          res.status(401).json({ error: "Missing Authorization header" });
          return;
        }
        const [scheme, token] = authHeader.split(" ");
        if (scheme !== "Bearer" || token !== secret) {
          res.status(401).json({ error: "Invalid credentials" });
          return;
        }
        next();
      });
      console.error("Static bearer token authentication enabled");
    }
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
    const bearerAuth = requireBearerAuth({ verifier: oauthProvider });

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

    // Mount MCP handlers at both / and /mcp for compatibility
    app.post("/", bearerAuth, mcpHandler);
    app.get("/", bearerAuth, mcpHandler);
    app.delete("/", bearerAuth, mcpDeleteHandler);
    app.post("/mcp", bearerAuth, mcpHandler);
    app.get("/mcp", bearerAuth, mcpHandler);
    app.delete("/mcp", bearerAuth, mcpDeleteHandler);

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
