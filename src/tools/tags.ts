import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  Tag,
  EnhancedTag,
} from "../client.js";
import {
  formatTime,
  getToday,
  formatError,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Formatting helpers (tags-specific)
// ─────────────────────────────────────────────────────────────

function formatTag(tag: Tag): string {
  const lines = [
    `## Tag: ${tag.day}`,
    `**Time:** ${formatTime(tag.timestamp)}`,
  ];

  if (tag.tags && tag.tags.length > 0) {
    lines.push(`**Tags:** ${tag.tags.join(", ")}`);
  }

  if (tag.text) {
    lines.push(`**Note:** ${tag.text}`);
  }

  return lines.join("\n");
}

function formatEnhancedTag(tag: EnhancedTag): string {
  // Format the tag type - either custom name or predefined code
  const tagName = tag.custom_name || formatTagTypeCode(tag.tag_type_code);

  const lines = [
    `## ${tagName}`,
    `**Date:** ${tag.start_day}`,
    `**Time:** ${formatTime(tag.start_time)}`,
  ];

  // Add duration if there's an end time
  if (tag.end_time) {
    lines.push(`**End:** ${formatTime(tag.end_time)}`);
  }

  // Add comment if present
  if (tag.comment) {
    lines.push(`**Note:** ${tag.comment}`);
  }

  return lines.join("\n");
}

function formatTagTypeCode(code: string | null | undefined): string {
  if (!code) return "Tag";
  if (code === "custom") return "Custom Tag";

  // Convert tag_type_code like "tag_sleep_aid" to "Sleep Aid"
  return code
    .replace(/^tag_/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ─────────────────────────────────────────────────────────────
// Register Tags Tools
// ─────────────────────────────────────────────────────────────

export function registerTagsTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_tags tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_tags",
    {
      description:
        "Get user-created tags and notes. Tags help track lifestyle factors like caffeine, alcohol, meals, or custom notes that may affect sleep and recovery.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getTags(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No tags found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Tags are manual lifestyle notes you add in the Oura app (like caffeine, alcohol, or custom notes) to track how habits affect your health. Workouts are tracked automatically via get_workouts.`,
              },
            ],
          };
        }

        const formatted = response.data.map((tag) => formatTag(tag));

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
  // get_enhanced_tags tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_enhanced_tags",
    {
      description:
        "Get enhanced tags with rich data including custom tags, timestamps, and durations. Enhanced tags include predefined categories (sleep_aid, caffeine, alcohol, etc.) and custom user-created tags with names like medications, supplements, or lifestyle factors.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getEnhancedTags(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No enhanced tags found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Tags are manual lifestyle notes you add in the Oura app (like caffeine, alcohol, stress, or custom notes). Workouts and sleep are tracked automatically—use get_workouts or get_sleep instead.`,
              },
            ],
          };
        }

        const formatted = response.data.map((tag) => formatEnhancedTag(tag));

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
