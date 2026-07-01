import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  RestModePeriod,
  RingConfiguration,
  PersonalInfo,
} from "../client.js";
import {
  getToday,
  getDaysAgo,
  formatError,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Register Device Tools
// ─────────────────────────────────────────────────────────────

export function registerDeviceTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_rest_mode tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_rest_mode",
    {
      description:
        "Get rest mode periods when you've enabled rest mode in the Oura app (typically during illness or recovery). Shows when rest mode was active and any notes.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to 30 days ago."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to today."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const endDate = end_date || getToday();
        const startDate = start_date || getDaysAgo(30);

        const response = await client.getRestModePeriods(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No rest mode periods found between ${startDate} and ${endDate}. Rest mode is enabled manually in the Oura app when you need extra recovery time.`,
              },
            ],
          };
        }

        const formatted = response.data.map((rm: RestModePeriod) => {
          const lines = [`## Rest Mode Period`];
          lines.push(`- **Start:** ${rm.start_day}`);
          if (rm.end_day) {
            lines.push(`- **End:** ${rm.end_day}`);
            // Calculate duration
            const start = new Date(rm.start_day);
            const end = new Date(rm.end_day);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            lines.push(`- **Duration:** ${days} day${days > 1 ? "s" : ""}`);
          } else {
            lines.push("- **Status:** Currently active");
          }

          // Episodes within the rest mode period
          if (rm.episodes && rm.episodes.length > 0) {
            lines.push("");
            lines.push("**Episodes:**");
            for (const ep of rm.episodes) {
              lines.push(`- ${ep.timestamp}: ${ep.tags?.join(", ") || "No tags"}`);
            }
          }

          return lines.join("\n");
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
          content: [{ type: "text" as const, text: formatError(error) }],
        };
      }
    }
  );

  // ─────────────────────────────────────────────────────────────
  // get_ring_info tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_ring_info",
    {
      description:
        "Get information about your Oura ring hardware including model, color, firmware version, and configuration.",
      inputSchema: {},
    },
    async () => {
      try {
        const response = await client.getRingConfiguration();

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No ring configuration found. Make sure your ring is set up in the Oura app.",
              },
            ],
          };
        }

        const formatted = response.data.map((ring: RingConfiguration) => {
          const lines = [`## Oura Ring`];

          if (ring.color) {
            lines.push(`- **Color:** ${ring.color}`);
          }
          if (ring.design) {
            lines.push(`- **Design:** ${ring.design}`);
          }
          if (ring.firmware_version) {
            lines.push(`- **Firmware:** ${ring.firmware_version}`);
          }
          if (ring.hardware_type) {
            lines.push(`- **Hardware Type:** ${ring.hardware_type}`);
          }
          if (ring.set_up_at) {
            lines.push(`- **Set Up:** ${ring.set_up_at}`);
          }
          if (ring.size !== undefined) {
            lines.push(`- **Size:** ${ring.size}`);
          }

          return lines.join("\n");
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
          content: [{ type: "text" as const, text: formatError(error) }],
        };
      }
    }
  );

  // ─────────────────────────────────────────────────────────────
  // get_personal_info tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_personal_info",
    {
      description:
        "Get your Oura profile information including age, weight, height, and biological sex. This data is used by Oura to personalize insights.",
      inputSchema: {},
    },
    async () => {
      try {
        const response: PersonalInfo = await client.getPersonalInfo();

        const lines = [`## Personal Info`];

        if (response.age !== undefined) {
          lines.push(`- **Age:** ${response.age}`);
        }
        if (response.weight !== undefined) {
          lines.push(`- **Weight:** ${response.weight} kg`);
        }
        if (response.height !== undefined) {
          lines.push(`- **Height:** ${response.height} cm`);
        }
        if (response.biological_sex) {
          lines.push(`- **Biological Sex:** ${response.biological_sex}`);
        }
        if (response.email) {
          lines.push(`- **Email:** ${response.email}`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
        };
      }
    }
  );
}
