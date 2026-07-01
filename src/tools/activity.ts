import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  Workout,
  Session,
} from "../client.js";
import {
  formatDuration,
  formatTime,
  formatScore,
  getToday,
  getDaysAgo,
  formatError,
  mean,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Formatting helpers (activity-specific)
// ─────────────────────────────────────────────────────────────

function formatWorkout(workout: Workout): string {
  const lines = [
    `## Workout: ${workout.day}`,
    `**Activity:** ${workout.activity}${workout.label ? ` (${workout.label})` : ""}`,
    `**Time:** ${formatTime(workout.start_datetime)} → ${formatTime(workout.end_datetime)}`,
    `**Intensity:** ${workout.intensity.charAt(0).toUpperCase() + workout.intensity.slice(1)}`,
  ];

  if (workout.calories !== null && workout.calories !== undefined) {
    lines.push(`**Calories:** ${workout.calories.toLocaleString()} kcal`);
  }

  if (workout.distance !== null && workout.distance !== undefined) {
    lines.push(`**Distance:** ${(workout.distance / 1000).toFixed(2)} km`);
  }

  lines.push(`**Source:** ${workout.source}`);

  return lines.join("\n");
}

function formatSession(session: Session): string {
  const typeLabel = session.type.charAt(0).toUpperCase() + session.type.slice(1).replace(/_/g, " ");

  const lines = [
    `## ${typeLabel} Session: ${session.day}`,
    `**Time:** ${formatTime(session.start_datetime)} → ${formatTime(session.end_datetime)}`,
  ];

  if (session.mood) {
    const moodLabel = session.mood.charAt(0).toUpperCase() + session.mood.slice(1);
    lines.push(`**Mood:** ${moodLabel}`);
  }

  // Add biometrics if available
  if (session.heart_rate || session.heart_rate_variability) {
    lines.push("");
    lines.push("**Biometrics:**");

    if (session.heart_rate) {
      const hrItems = session.heart_rate.items || [];
      if (hrItems.length > 0) {
        const validHr = hrItems.filter((hr): hr is number => hr !== null);
        if (validHr.length > 0) {
          const avgHr = Math.round(validHr.reduce((a, b) => a + b, 0) / validHr.length);
          lines.push(`- Avg Heart Rate: ${avgHr} bpm`);
        }
      }
    }

    if (session.heart_rate_variability) {
      const hrvItems = session.heart_rate_variability.items || [];
      if (hrvItems.length > 0) {
        const validHrv = hrvItems.filter((hrv): hrv is number => hrv !== null);
        if (validHrv.length > 0) {
          const avgHrv = Math.round(validHrv.reduce((a, b) => a + b, 0) / validHrv.length);
          lines.push(`- Avg HRV: ${avgHrv} ms`);
        }
      }
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Register Activity Tools
// ─────────────────────────────────────────────────────────────

export function registerActivityTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_activity tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_activity",
    {
      description:
        "Get daily activity data including steps, calories, and activity breakdown (high/medium/low intensity). Use this to analyze movement and exercise patterns.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailyActivity(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No activity data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => {
          return [
            `## Activity: ${day.day}`,
            `**Score:** ${formatScore(day.score)}`,
            `**Steps:** ${day.steps.toLocaleString()}`,
            `**Calories:** ${day.total_calories.toLocaleString()} total (${day.active_calories.toLocaleString()} active)`,
            `**Walking Equivalent:** ${(day.equivalent_walking_distance / 1000).toFixed(1)} km`,
            "",
            "**Activity Breakdown:**",
            `- High Intensity: ${formatDuration(day.high_activity_time)}`,
            `- Medium Intensity: ${formatDuration(day.medium_activity_time)}`,
            `- Low Intensity: ${formatDuration(day.low_activity_time)}`,
            `- Sedentary: ${formatDuration(day.sedentary_time)}`,
            `- Resting: ${formatDuration(day.resting_time)}`,
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
  // get_workouts tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_workouts",
    {
      description:
        "Get workout sessions with activity type, duration, intensity, calories burned, and distance. Use this to analyze exercise patterns, workout frequency, and training load.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getWorkouts(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No workout data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((workout) => formatWorkout(workout));

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
  // get_sessions tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_sessions",
    {
      description:
        "Get meditation, breathing, and relaxation sessions recorded with Oura. Includes session type, duration, and biometrics like heart rate and HRV during the session.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getSessions(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No sessions found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Sessions include meditation and breathing exercises done through the Oura app.`,
              },
            ],
          };
        }

        const formatted = response.data.map((session) => formatSession(session));

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
  // analyze_adherence tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "analyze_adherence",
    {
      description:
        "Analyze how consistently you wear your Oura ring. Shows daily non-wear time, identifies gaps in data, and calculates adherence percentage. Useful for understanding data quality.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
      },
    },
    async ({ days = 30 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        const activityResult = await client.getDailyActivity(startDate, endDate);
        const data = activityResult.data;

        if (data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No activity data found for the past ${days} days.`,
              },
            ],
          };
        }

        const lines = [
          `## Ring Adherence Analysis (${days} days)`,
          "",
        ];

        // Calculate total days in range
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const totalDaysInRange = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

        // Data coverage
        const daysWithData = data.length;
        const missingDays = totalDaysInRange - daysWithData;
        const coveragePercent = Math.round((daysWithData / totalDaysInRange) * 100);

        lines.push("### Data Coverage");
        lines.push(`- Days with data: ${daysWithData} of ${totalDaysInRange} (${coveragePercent}%)`);
        if (missingDays > 0) {
          lines.push(`- Missing days: ${missingDays}`);
        }
        lines.push("");

        // Non-wear time analysis
        const nonWearTimes = data.map(d => d.non_wear_time ?? 0);
        const totalNonWear = nonWearTimes.reduce((a, b) => a + b, 0);
        const avgNonWear = totalNonWear / nonWearTimes.length;

        lines.push("### Non-Wear Time");
        lines.push(`- Average: ${formatDuration(avgNonWear)}/day`);
        lines.push(`- Total: ${formatDuration(totalNonWear)} over ${daysWithData} days`);

        // Days with high non-wear (> 4 hours)
        const highNonWearDays = data.filter(d => (d.non_wear_time ?? 0) > 4 * 3600);
        if (highNonWearDays.length > 0) {
          lines.push(`- Days with >4h non-wear: ${highNonWearDays.length}`);
          if (highNonWearDays.length <= 5) {
            lines.push("  " + highNonWearDays.map(d => `${d.day} (${formatDuration(d.non_wear_time ?? 0)})`).join(", "));
          }
        }
        lines.push("");

        // Adherence score (percentage of time ring was worn)
        // Assuming 24h day, calculate % of time worn
        const totalPossibleSeconds = daysWithData * 24 * 3600;
        const wearPercent = Math.round(((totalPossibleSeconds - totalNonWear) / totalPossibleSeconds) * 100);

        lines.push("### Adherence Score");
        lines.push(`- **${wearPercent}%** of time wearing ring`);
        if (wearPercent >= 90) {
          lines.push("- ✓ Excellent adherence - data quality is high");
        } else if (wearPercent >= 75) {
          lines.push("- Good adherence - some data may be missing");
        } else if (wearPercent >= 50) {
          lines.push("- ⚠ Moderate adherence - consider wearing ring more consistently");
        } else {
          lines.push("- ⚠ Low adherence - data quality may be affected");
        }
        lines.push("");

        // Identify data gaps (missing consecutive days)
        const allDays = new Set(data.map(d => d.day));
        const gaps: { start: string; end: string; days: number }[] = [];
        let currentDate = new Date(startDate);
        let gapStart: string | null = null;
        let gapDays = 0;

        while (currentDate <= new Date(endDate)) {
          const dateStr = currentDate.toISOString().split("T")[0];
          if (!allDays.has(dateStr)) {
            if (!gapStart) gapStart = dateStr;
            gapDays++;
          } else {
            if (gapStart && gapDays > 1) {
              const prevDate = new Date(currentDate);
              prevDate.setDate(prevDate.getDate() - 1);
              gaps.push({ start: gapStart, end: prevDate.toISOString().split("T")[0], days: gapDays });
            }
            gapStart = null;
            gapDays = 0;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        // Handle gap at end
        if (gapStart && gapDays > 1) {
          gaps.push({ start: gapStart, end: endDate, days: gapDays });
        }

        if (gaps.length > 0) {
          lines.push("### Data Gaps (2+ days)");
          for (const gap of gaps) {
            lines.push(`- ${gap.start} to ${gap.end} (${gap.days} days)`);
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
        };
      }
    }
  );
}
