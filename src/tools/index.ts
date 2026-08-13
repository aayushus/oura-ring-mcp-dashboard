/**
 * MCP Tools for Oura Ring data
 *
 * Phase 1: Basic sleep tool
 * Phase 2: Add readiness, activity
 * Phase 3: Add derived/smart tools (compare, correlate, trends)
 *
 * This file re-exports domain-specific tool registration functions
 * and provides a single `registerTools` entry point with dynamic multi-tenant client proxying.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OuraClient } from "../client.js";
import { getContextOuraClient } from "../auth/context.js";

export { registerSleepTools } from "./sleep.js";
export { registerReadinessTools } from "./readiness.js";
export { registerActivityTools } from "./activity.js";
export { registerHealthTools } from "./health.js";
export { registerAnalysisTools } from "./analysis.js";
export { registerTagsTools } from "./tags.js";
export { registerDeviceTools } from "./device.js";

// Also re-export formatting helpers used by tests
export { formatSleepSession, formatDailySleep } from "./sleep.js";

import { registerSleepTools } from "./sleep.js";
import { registerReadinessTools } from "./readiness.js";
import { registerActivityTools } from "./activity.js";
import { registerHealthTools } from "./health.js";
import { registerAnalysisTools } from "./analysis.js";
import { registerTagsTools } from "./tags.js";
import { registerDeviceTools } from "./device.js";

/**
 * Creates a dynamic OuraClient proxy that always delegates method calls
 * to the active user's OuraClient from the current request context (if set),
 * falling back to the default server client.
 */
export function createDynamicOuraClient(defaultClient: OuraClient): OuraClient {
  return new Proxy(defaultClient, {
    get(target, prop, receiver) {
      const activeClient = getContextOuraClient() ?? target;
      const value = Reflect.get(activeClient, prop, receiver);
      if (typeof value === "function") {
        return value.bind(activeClient);
      }
      return value;
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Register Tools with McpServer
// ─────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, client: OuraClient) {
  const dynamicClient = createDynamicOuraClient(client);

  registerSleepTools(server, dynamicClient);
  registerReadinessTools(server, dynamicClient);
  registerActivityTools(server, dynamicClient);
  registerHealthTools(server, dynamicClient);
  registerAnalysisTools(server, dynamicClient);
  registerTagsTools(server, dynamicClient);
  registerDeviceTools(server, dynamicClient);
}
