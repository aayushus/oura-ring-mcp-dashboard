import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  DailyResilience,
} from "../client.js";
import {
  formatScore,
  getToday,
  formatError,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Formatting helpers (readiness-specific)
// ─────────────────────────────────────────────────────────────

function formatResilience(day: DailyResilience): string {
  const c = day.contributors;
  const levelLabel = day.level.charAt(0).toUpperCase() + day.level.slice(1);

  return [
    `## Resilience: ${day.day}`,
    `**Level:** ${levelLabel}`,
    "",
    "**Contributors:**",
    `- Sleep Recovery: ${c.sleep_recovery}`,
    `- Daytime Recovery: ${c.daytime_recovery}`,
    `- Stress: ${c.stress}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────
// Register Readiness Tools
// ─────────────────────────────────────────────────────────────

export function registerReadinessTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_readiness tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_readiness",
    {
      description:
        "Get daily readiness scores and contributors (HRV balance, resting heart rate, body temperature, recovery). Use this to understand recovery and readiness to perform.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailyReadiness(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No readiness data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => {
          const c = day.contributors;
          return [
            `## Readiness: ${day.day}`,
            `**Score:** ${formatScore(day.score)}`,
            "",
            "**Contributors:**",
            `- HRV Balance: ${c.hrv_balance ?? "N/A"}`,
            `- Resting Heart Rate: ${c.resting_heart_rate ?? "N/A"}`,
            `- Recovery Index: ${c.recovery_index ?? "N/A"}`,
            `- Sleep Balance: ${c.sleep_balance ?? "N/A"}`,
            `- Sleep Regularity: ${(c as Record<string, unknown>).sleep_regularity ?? "N/A"}`,
            `- Previous Night: ${c.previous_night ?? "N/A"}`,
            `- Previous Day Activity: ${c.previous_day_activity ?? "N/A"}`,
            `- Activity Balance: ${c.activity_balance ?? "N/A"}`,
            `- Body Temperature: ${c.body_temperature ?? "N/A"}`,
            day.temperature_deviation !== null
              ? `\n**Temperature Deviation:** ${day.temperature_deviation}°C`
              : "",
            day.temperature_trend_deviation !== null
              ? `**Temperature Trend:** ${day.temperature_trend_deviation}°C`
              : "",
          ].join("\n");
        });

        return {
          content: [
            {
              type: "text" as const,
              text: formatted.join("\n\n---\n\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError(error),
            },
          ],
        };
      }
    }
  );

  // ─────────────────────────────────────────────────────────────
  // get_resilience tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_resilience",
    {
      description:
        "Get daily resilience scores showing your body's capacity to recover from stress. Includes sleep recovery, daytime recovery, and stress contributors. Resilience levels range from limited to exceptional.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailyResilience(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No resilience data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => formatResilience(day));

        return {
          content: [
            {
              type: "text" as const,
              text: formatted.join("\n\n---\n\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatError(error),
            },
          ],
        };
      }
    }
  );
}
