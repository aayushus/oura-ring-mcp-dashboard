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
import { getHistory } from "../db.js";
import { syncData, startSyncScheduler } from "../sync.js";
import { getToday, getDaysAgo } from "../utils/index.js";

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

  // Get health summary history (last 30 days)
  app.get("/api/dashboard/summary", async (_req: Request, res: Response) => {
    try {
      let history = await getHistory(30);

      // Auto-sync if DB is empty and client is available
      const isEmpty = history.sleep.length === 0 && history.readiness.length === 0;
      if (isEmpty && ouraClient) {
        console.error("[HTTP] Database empty, triggering auto-sync...");
        const syncResult = await syncData(ouraClient, getDaysAgo(30), getToday());
        if (syncResult.success) {
          history = await getHistory(30);
        }
      }

      res.json(history);
    } catch (err) {
      console.error("Dashboard summary API error:", err);
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
