/**
 * MCP Tools for Oura Ring data
 *
 * Phase 1: Basic sleep tool
 * Phase 2: Add readiness, activity
 * Phase 3: Add derived/smart tools (compare, correlate, trends)
 *
 * This file re-exports domain-specific tool registration functions
 * and provides a single `registerTools` entry point.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OuraClient } from "../client.js";

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

// ─────────────────────────────────────────────────────────────
// Register Tools with McpServer
// ─────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, client: OuraClient) {
  registerSleepTools(server, client);
  registerReadinessTools(server, client);
  registerActivityTools(server, client);
  registerHealthTools(server, client);
  registerAnalysisTools(server, client);
  registerTagsTools(server, client);
  registerDeviceTools(server, client);
}
