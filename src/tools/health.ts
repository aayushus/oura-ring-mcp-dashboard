import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  DailyStress,
  HeartRate,
  DailySpo2,
  VO2Max,
  DailyCardiovascularAge,
} from "../client.js";
import {
  formatDuration,
  formatTime,
  getToday,
  getDaysAgo,
  formatError,
  dispersion,
  trend,
  dayOfWeekAnalysis,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Formatting helpers (health-specific)
// ─────────────────────────────────────────────────────────────

function formatStress(day: DailyStress): string {
  const lines = [
    `## Stress: ${day.day}`,
  ];

  if (day.day_summary) {
    const summaryLabel = day.day_summary.charAt(0).toUpperCase() + day.day_summary.slice(1);
    lines.push(`**Day Summary:** ${summaryLabel}`);
    lines.push("");
  }

  lines.push("**Time Breakdown:**");

  if (day.stress_high !== null && day.stress_high !== undefined) {
    lines.push(`- High Stress: ${formatDuration(day.stress_high)}`);
  } else {
    lines.push("- High Stress: N/A");
  }

  if (day.recovery_high !== null && day.recovery_high !== undefined) {
    lines.push(`- High Recovery: ${formatDuration(day.recovery_high)}`);
  } else {
    lines.push("- High Recovery: N/A");
  }

  return lines.join("\n");
}

function formatHeartRateData(readings: HeartRate[]): string {
  // Handle empty array edge case
  if (readings.length === 0) {
    return "## Heart Rate Data (0 readings)\n\nNo heart rate readings available.";
  }

  // Group readings by source for better readability
  const bySource: Record<string, HeartRate[]> = {};

  readings.forEach((reading) => {
    const source = reading.source;
    if (!bySource[source]) {
      bySource[source] = [];
    }
    bySource[source].push(reading);
  });

  const lines = [
    `## Heart Rate Data (${readings.length} readings)`,
    "",
  ];

  // Calculate overall stats
  const allBpms = readings.map((r) => r.bpm);
  const avgBpm = Math.round(allBpms.reduce((a, b) => a + b, 0) / allBpms.length);
  const minBpm = Math.min(...allBpms);
  const maxBpm = Math.max(...allBpms);

  lines.push("**Overall Statistics:**");
  lines.push(`- Average: ${avgBpm} bpm`);
  lines.push(`- Range: ${minBpm} - ${maxBpm} bpm`);
  lines.push("");

  lines.push("**Breakdown by Source:**");
  Object.entries(bySource).forEach(([source, sourceReadings]) => {
    const sourceBpms = sourceReadings.map((r) => r.bpm);
    const sourceAvg = Math.round(sourceBpms.reduce((a, b) => a + b, 0) / sourceBpms.length);
    const sourceLabel = source.charAt(0).toUpperCase() + source.slice(1);
    lines.push(`- ${sourceLabel}: ${sourceReadings.length} readings, avg ${sourceAvg} bpm`);
  });

  return lines.join("\n");
}

function formatSpo2(day: DailySpo2): string {
  const lines = [
    `## SpO2: ${day.day}`,
  ];

  if (day.spo2_percentage?.average != null) {
    lines.push(`**Average SpO2:** ${day.spo2_percentage.average.toFixed(1)}%`);
  } else {
    lines.push("**Average SpO2:** N/A");
  }

  if (day.breathing_disturbance_index !== null && day.breathing_disturbance_index !== undefined) {
    lines.push(`**Breathing Disturbance Index:** ${day.breathing_disturbance_index.toFixed(1)}`);

    // Add context for BDI
    let bdiContext = "";
    if (day.breathing_disturbance_index < 5) {
      bdiContext = "(Normal)";
    } else if (day.breathing_disturbance_index < 15) {
      bdiContext = "(Mild disturbance)";
    } else if (day.breathing_disturbance_index < 30) {
      bdiContext = "(Moderate disturbance)";
    } else {
      bdiContext = "(Significant disturbance - consider consulting a doctor)";
    }
    lines.push(`  ${bdiContext}`);
  } else {
    lines.push("**Breathing Disturbance Index:** N/A");
  }

  return lines.join("\n");
}

function formatVO2Max(measurement: VO2Max): string {
  const lines = [
    `## VO2 Max: ${measurement.day}`,
  ];

  if (measurement.vo2_max !== null) {
    lines.push(`**VO2 Max:** ${measurement.vo2_max.toFixed(1)} ml/kg/min`);

    // Add fitness level context (approximate ranges for adults)
    let fitnessLevel = "";
    const vo2 = measurement.vo2_max;
    if (vo2 < 30) {
      fitnessLevel = "(Poor)";
    } else if (vo2 < 40) {
      fitnessLevel = "(Below average)";
    } else if (vo2 < 45) {
      fitnessLevel = "(Average)";
    } else if (vo2 < 50) {
      fitnessLevel = "(Good)";
    } else if (vo2 < 55) {
      fitnessLevel = "(Very good)";
    } else {
      fitnessLevel = "(Excellent)";
    }
    lines.push(`  ${fitnessLevel}`);
  } else {
    lines.push("**VO2 Max:** N/A");
  }

  lines.push(`**Measured:** ${formatTime(measurement.timestamp)}`);

  return lines.join("\n");
}

function formatCardiovascularAge(day: DailyCardiovascularAge): string {
  const lines = [
    `## Cardiovascular Age: ${day.day}`,
  ];

  if (day.vascular_age !== null) {
    lines.push(`**Vascular Age:** ${day.vascular_age} years`);
  } else {
    lines.push("**Vascular Age:** N/A");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Register Health Tools
// ─────────────────────────────────────────────────────────────

export function registerHealthTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_heart_rate tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_heart_rate",
    {
      description:
        "Get individual heart rate readings throughout the day with timestamps and source (awake, rest, sleep, workout, etc.). Returns detailed time-series data. Use this for analyzing heart rate patterns, variability throughout the day, or correlating HR with activities.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getHeartRate(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No heart rate data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = formatHeartRateData(response.data);

        return {
          content: [
            {
              type: "text" as const,
              text: formatted,
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
  // get_stress tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_stress",
    {
      description:
        "Get daily stress levels and recovery time. Shows time spent in high stress vs high recovery zones, plus overall day summary (restored/normal/stressful). Use this to understand stress patterns and recovery balance.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailyStress(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No stress data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => formatStress(day));

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
  // get_spo2 tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_spo2",
    {
      description:
        "Get daily SpO2 (blood oxygen saturation) percentage and breathing disturbance index. Use this to monitor respiratory health, detect sleep apnea patterns, or understand overnight oxygen levels.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailySpo2(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No SpO2 data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Note: SpO2 tracking requires a compatible Oura Ring (Gen 3 or later).`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => formatSpo2(day));

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
  // get_vo2_max tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_vo2_max",
    {
      description:
        "Get VO2 max measurements (cardiorespiratory fitness). VO2 max indicates the maximum amount of oxygen your body can use during intense exercise. Higher values indicate better cardiovascular fitness. Use this to track fitness improvements over time.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getVO2Max(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No VO2 max data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Note: VO2 max estimates require regular activity and workout data.`,
              },
            ],
          };
        }

        const formatted = response.data.map((measurement) => formatVO2Max(measurement));

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
  // get_cardiovascular_age tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_cardiovascular_age",
    {
      description:
        "Get your estimated cardiovascular (vascular) age based on heart health metrics. Compare your vascular age to your actual age to understand your cardiovascular health.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailyCardiovascularAge(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No cardiovascular age data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Note: This feature requires sufficient data and may not be available for all users.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => formatCardiovascularAge(day));

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
  // analyze_temperature tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "analyze_temperature",
    {
      description:
        "Analyze body temperature patterns from readiness data. Temperature deviations can indicate illness, menstrual cycle phases, or environmental factors. Shows trends and flags unusual readings.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
      },
    },
    async ({ days = 30 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        const response = await client.getDailyReadiness(startDate, endDate);
        const data = response.data.filter(r => r.temperature_deviation !== null && r.temperature_deviation !== undefined);

        if (data.length < 5) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Need at least 5 days of temperature data for analysis. Found ${data.length} days with temperature readings in the past ${days} days.`,
              },
            ],
          };
        }

        const temps = data.map(r => r.temperature_deviation!);
        const tempData = data.map(r => ({ date: r.day, value: r.temperature_deviation! }));

        const lines = [
          `## Body Temperature Analysis (${days} days)`,
          "",
        ];

        // Overview
        const stats = dispersion(temps);
        lines.push("### Overview");
        lines.push(`- **Current:** ${temps[temps.length - 1] >= 0 ? "+" : ""}${temps[temps.length - 1].toFixed(2)}°C from baseline`);
        lines.push(`- **Average deviation:** ${stats.mean >= 0 ? "+" : ""}${stats.mean.toFixed(2)}°C`);
        lines.push(`- **Range:** ${stats.min.toFixed(2)}°C to ${stats.max >= 0 ? "+" : ""}${stats.max.toFixed(2)}°C`);
        lines.push("");

        // Trend
        const tempTrend = trend(temps);
        lines.push("### Trend");
        if (tempTrend.direction === "improving") {
          // For temperature, "improving" means increasing (slope > 0)
          lines.push("↑ Temperature is **trending up** - could indicate:");
          lines.push("  - Onset of illness");
          lines.push("  - Luteal phase (for menstrual cycles)");
          lines.push("  - Increased stress or inflammation");
        } else if (tempTrend.direction === "declining") {
          lines.push("↓ Temperature is **trending down** - could indicate:");
          lines.push("  - Recovery from illness");
          lines.push("  - Follicular phase (for menstrual cycles)");
          lines.push("  - Good recovery");
        } else {
          lines.push("→ Temperature is **stable**");
        }
        lines.push("");

        // Elevated days (potential illness)
        const elevatedDays = data.filter(r => r.temperature_deviation! > 0.5);
        if (elevatedDays.length > 0) {
          lines.push("### Elevated Days (>+0.5°C)");
          lines.push("*May indicate illness, stress, or hormonal changes*");
          lines.push("");
          for (const day of elevatedDays.slice(-5)) {
            lines.push(`- ${day.day}: +${day.temperature_deviation!.toFixed(2)}°C`);
          }
          if (elevatedDays.length > 5) {
            lines.push(`- ... and ${elevatedDays.length - 5} more days`);
          }
          lines.push("");
        }

        // Weekly pattern
        const dowAnalysis = dayOfWeekAnalysis(tempData);
        lines.push("### Weekly Pattern");
        lines.push(`- **Highest avg:** ${dowAnalysis.bestDay.day} (${dowAnalysis.bestDay.average >= 0 ? "+" : ""}${dowAnalysis.bestDay.average.toFixed(2)}°C)`);
        lines.push(`- **Lowest avg:** ${dowAnalysis.worstDay.day} (${dowAnalysis.worstDay.average >= 0 ? "+" : ""}${dowAnalysis.worstDay.average.toFixed(2)}°C)`);
        lines.push("");

        // Body temperature contributor from readiness
        const tempContributors = data
          .filter(r => r.contributors?.body_temperature !== null && r.contributors?.body_temperature !== undefined)
          .map(r => r.contributors!.body_temperature!);

        if (tempContributors.length > 0) {
          const avgContributor = tempContributors.reduce((a, b) => a + b, 0) / tempContributors.length;
          lines.push("### Impact on Readiness");
          lines.push(`- Average temperature contributor: ${Math.round(avgContributor)}/100`);
          if (avgContributor < 70) {
            lines.push("- ⚠ Temperature is negatively affecting your readiness");
          } else {
            lines.push("- ✓ Temperature is within healthy range for readiness");
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
