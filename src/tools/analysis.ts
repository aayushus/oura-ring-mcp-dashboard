import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  SleepSession,
  DailyReadiness,
  DailyActivity,
} from "../client.js";
import {
  getToday,
  getDaysAgo,
  formatError,
  mean,
  detectOutliers,
  correlate,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Register Analysis Tools
// ─────────────────────────────────────────────────────────────

export function registerAnalysisTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // detect_anomalies tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "detect_anomalies",
    {
      description:
        "Detect unusual readings in your health data over a time period. Uses statistical methods (IQR and Z-score) to flag outliers in sleep, HRV, heart rate, and activity. Useful for identifying nights with unusually poor sleep, stress spikes, or other anomalies.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
        metrics: z
          .array(z.enum(["sleep_score", "hrv", "heart_rate", "deep_sleep", "efficiency", "readiness", "activity"]))
          .optional()
          .describe("Which metrics to check for anomalies (default: all)"),
      },
    },
    async ({ days = 30, metrics }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        // Fetch data in parallel
        const [sleepResult, readinessResult, activityResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailyReadiness(startDate, endDate),
          client.getDailyActivity(startDate, endDate),
        ]);

        // Filter to only main sleep sessions (exclude naps, rest periods)
        const allSleep = sleepResult.status === "fulfilled" ? sleepResult.value.data : [];
        const sleepSessions: SleepSession[] = allSleep.filter((s) => s.type === "long_sleep");
        const readinessData: DailyReadiness[] = readinessResult.status === "fulfilled" ? readinessResult.value.data : [];
        const activityData: DailyActivity[] = activityResult.status === "fulfilled" ? activityResult.value.data : [];

        if (sleepSessions.length === 0 && readinessData.length === 0 && activityData.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No data found for the past ${days} days.` }],
          };
        }

        const allMetrics = ["sleep_score", "hrv", "heart_rate", "deep_sleep", "efficiency", "readiness", "activity"];
        const metricsToCheck = metrics || allMetrics;
        const anomalies: Array<{ metric: string; date: string; value: number; expected: string }> = [];

        // Extract and check each metric
        if (metricsToCheck.includes("hrv") && sleepSessions.length >= 5) {
          const hrvData = sleepSessions
            .filter((s) => s.average_hrv != null)
            .map((s) => ({ day: s.day, value: s.average_hrv! }));
          const hrvValues = hrvData.map((d) => d.value);
          const hrvOutliers = detectOutliers(hrvValues);
          hrvOutliers.outliers.forEach((o) => {
            const dataPoint = hrvData[o.index];
            anomalies.push({
              metric: "HRV",
              date: dataPoint.day,
              value: Math.round(o.value),
              expected: `${Math.round(hrvOutliers.lowerBound)}-${Math.round(hrvOutliers.upperBound)} ms`,
            });
          });
        }

        if (metricsToCheck.includes("heart_rate") && sleepSessions.length >= 5) {
          const hrData = sleepSessions
            .filter((s) => s.average_heart_rate != null)
            .map((s) => ({ day: s.day, value: s.average_heart_rate! }));
          const hrValues = hrData.map((d) => d.value);
          const hrOutliers = detectOutliers(hrValues);
          hrOutliers.outliers.forEach((o) => {
            const dataPoint = hrData[o.index];
            anomalies.push({
              metric: "Resting HR",
              date: dataPoint.day,
              value: Math.round(o.value),
              expected: `${Math.round(hrOutliers.lowerBound)}-${Math.round(hrOutliers.upperBound)} bpm`,
            });
          });
        }

        if (metricsToCheck.includes("deep_sleep") && sleepSessions.length >= 5) {
          const deepData = sleepSessions
            .filter((s) => s.deep_sleep_duration != null)
            .map((s) => ({ day: s.day, value: s.deep_sleep_duration! / 3600 })); // Convert to hours
          const deepValues = deepData.map((d) => d.value);
          const deepOutliers = detectOutliers(deepValues);
          deepOutliers.outliers.forEach((o) => {
            const dataPoint = deepData[o.index];
            anomalies.push({
              metric: "Deep Sleep",
              date: dataPoint.day,
              value: Math.round(o.value * 10) / 10,
              expected: `${(deepOutliers.lowerBound).toFixed(1)}-${(deepOutliers.upperBound).toFixed(1)} hours`,
            });
          });
        }

        if (metricsToCheck.includes("efficiency") && sleepSessions.length >= 5) {
          const effData = sleepSessions
            .filter((s) => s.efficiency != null)
            .map((s) => ({ day: s.day, value: s.efficiency! }));
          const effValues = effData.map((d) => d.value);
          const effOutliers = detectOutliers(effValues);
          effOutliers.outliers.forEach((o) => {
            const dataPoint = effData[o.index];
            anomalies.push({
              metric: "Sleep Efficiency",
              date: dataPoint.day,
              value: Math.round(o.value),
              expected: `${Math.round(effOutliers.lowerBound)}-${Math.round(effOutliers.upperBound)}%`,
            });
          });
        }

        if (metricsToCheck.includes("readiness") && readinessData.length >= 5) {
          const readData = readinessData
            .filter((r) => r.score != null)
            .map((r) => ({ day: r.day, value: r.score! }));
          const readValues = readData.map((d) => d.value);
          const readOutliers = detectOutliers(readValues);
          readOutliers.outliers.forEach((o) => {
            const dataPoint = readData[o.index];
            anomalies.push({
              metric: "Readiness Score",
              date: dataPoint.day,
              value: Math.round(o.value),
              expected: `${Math.round(readOutliers.lowerBound)}-${Math.round(readOutliers.upperBound)}`,
            });
          });
        }

        if (metricsToCheck.includes("activity") && activityData.length >= 5) {
          const actData = activityData
            .filter((a) => a.score != null)
            .map((a) => ({ day: a.day, value: a.score! }));
          const actValues = actData.map((d) => d.value);
          const actOutliers = detectOutliers(actValues);
          actOutliers.outliers.forEach((o) => {
            const dataPoint = actData[o.index];
            anomalies.push({
              metric: "Activity Score",
              date: dataPoint.day,
              value: Math.round(o.value),
              expected: `${Math.round(actOutliers.lowerBound)}-${Math.round(actOutliers.upperBound)}`,
            });
          });
        }

        // Sort anomalies by date (most recent first)
        anomalies.sort((a, b) => b.date.localeCompare(a.date));

        if (anomalies.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `## Anomaly Detection (${days} days)\n\n✓ No anomalies detected. All metrics are within normal ranges for your baseline.`,
              },
            ],
          };
        }

        const lines = [
          `## Anomaly Detection (${days} days)`,
          "",
          `Found ${anomalies.length} unusual reading${anomalies.length > 1 ? "s" : ""}:`,
          "",
        ];

        anomalies.forEach((a) => {
          const isLow = a.value < parseFloat(a.expected.split("-")[0]);
          const arrow = isLow ? "↓" : "↑";
          lines.push(`- **${a.date}** - ${a.metric}: ${a.value} ${arrow} (expected: ${a.expected})`);
        });

        lines.push("");
        lines.push("*Anomalies are flagged when values fall outside both IQR and Z-score bounds.*");

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

  // ─────────────────────────────────────────────────────────────
  // correlate_metrics tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "correlate_metrics",
    {
      description:
        "Find correlations between two health metrics. For example, see if your HRV correlates with sleep duration, or if activity affects your readiness. Returns correlation strength, direction, and statistical significance.",
      inputSchema: {
        metric1: z.enum(["sleep_duration", "deep_sleep", "rem_sleep", "hrv", "heart_rate", "efficiency", "readiness", "activity", "steps"]).describe("First metric to correlate"),
        metric2: z.enum(["sleep_duration", "deep_sleep", "rem_sleep", "hrv", "heart_rate", "efficiency", "readiness", "activity", "steps"]).describe("Second metric to correlate"),
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
      },
    },
    async ({ metric1, metric2, days = 30 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        // Fetch all data we might need
        const [sleepResult, readinessResult, activityResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailyReadiness(startDate, endDate),
          client.getDailyActivity(startDate, endDate),
        ]);

        // Filter to only main sleep sessions (exclude naps, rest periods)
        const allSleep = sleepResult.status === "fulfilled" ? sleepResult.value.data : [];
        const sleepSessions: SleepSession[] = allSleep.filter((s) => s.type === "long_sleep");
        const readinessData: DailyReadiness[] = readinessResult.status === "fulfilled" ? readinessResult.value.data : [];
        const activityData: DailyActivity[] = activityResult.status === "fulfilled" ? activityResult.value.data : [];

        // Create lookup maps by day
        const sleepByDay = new Map<string, SleepSession>(sleepSessions.map((s) => [s.day, s]));
        const readinessByDay = new Map<string, DailyReadiness>(readinessData.map((r) => [r.day, r]));
        const activityByDay = new Map<string, DailyActivity>(activityData.map((a) => [a.day, a]));

        // Helper to extract metric value
        const getMetricValue = (day: string, metric: string): number | null => {
          const sleep = sleepByDay.get(day);
          const readiness = readinessByDay.get(day);
          const activity = activityByDay.get(day);

          switch (metric) {
            case "sleep_duration":
              return sleep?.total_sleep_duration ? sleep.total_sleep_duration / 3600 : null;
            case "deep_sleep":
              return sleep?.deep_sleep_duration ? sleep.deep_sleep_duration / 3600 : null;
            case "rem_sleep":
              return sleep?.rem_sleep_duration ? sleep.rem_sleep_duration / 3600 : null;
            case "hrv":
              return sleep?.average_hrv ?? null;
            case "heart_rate":
              return sleep?.average_heart_rate ?? null;
            case "efficiency":
              return sleep?.efficiency ?? null;
            case "readiness":
              return readiness?.score ?? null;
            case "activity":
              return activity?.score ?? null;
            case "steps":
              return activity?.steps ?? null;
            default:
              return null;
          }
        };

        // Get all unique days
        const allDays = new Set([
          ...sleepSessions.map((s) => s.day),
          ...readinessData.map((r) => r.day),
          ...activityData.map((a) => a.day),
        ]);

        // Build paired data points
        const values1: number[] = [];
        const values2: number[] = [];

        for (const day of allDays) {
          const v1 = getMetricValue(day, metric1);
          const v2 = getMetricValue(day, metric2);
          if (v1 !== null && v2 !== null) {
            values1.push(v1);
            values2.push(v2);
          }
        }

        if (values1.length < 5) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Need at least 5 days with both metrics available. Found ${values1.length} matching days.`,
              },
            ],
          };
        }

        const result = correlate(values1, values2);
        const metricLabels: Record<string, string> = {
          sleep_duration: "Sleep Duration",
          deep_sleep: "Deep Sleep",
          rem_sleep: "REM Sleep",
          hrv: "HRV",
          heart_rate: "Heart Rate",
          efficiency: "Sleep Efficiency",
          readiness: "Readiness Score",
          activity: "Activity Score",
          steps: "Steps",
        };

        const lines = [
          `## Correlation Analysis`,
          "",
          `**${metricLabels[metric1]}** vs **${metricLabels[metric2]}**`,
          "",
          `- **Correlation:** ${result.correlation.toFixed(2)} (${result.strength} ${result.direction})`,
          `- **Statistical significance:** ${result.significant ? "Yes" : "No"} (p = ${result.pValue.toFixed(3)})`,
          `- **Sample size:** ${result.n} days`,
          "",
        ];

        // Interpretation
        if (result.strength === "none") {
          lines.push(`→ No meaningful relationship between these metrics.`);
        } else if (result.direction === "positive") {
          lines.push(`→ When ${metricLabels[metric1].toLowerCase()} increases, ${metricLabels[metric2].toLowerCase()} tends to increase.`);
        } else {
          lines.push(`→ When ${metricLabels[metric1].toLowerCase()} increases, ${metricLabels[metric2].toLowerCase()} tends to decrease.`);
        }

        if (!result.significant) {
          lines.push("");
          lines.push("*Note: This correlation is not statistically significant. More data may be needed.*");
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

  // ─────────────────────────────────────────────────────────────
  // compare_periods tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "compare_periods",
    {
      description:
        "Compare health metrics between two time periods. Great for answering questions like 'How did I sleep this week vs last week?' or 'Was my HRV better last month?'. Returns side-by-side comparison with percentage changes.",
      inputSchema: {
        period1_start: z.string().describe("Start date of first period (YYYY-MM-DD)"),
        period1_end: z.string().describe("End date of first period (YYYY-MM-DD)"),
        period2_start: z.string().describe("Start date of second period (YYYY-MM-DD)"),
        period2_end: z.string().describe("End date of second period (YYYY-MM-DD)"),
        metrics: z
          .array(z.enum(["sleep_duration", "sleep_score", "deep_sleep", "rem_sleep", "hrv", "heart_rate", "efficiency", "readiness", "activity", "steps"]))
          .optional()
          .describe("Which metrics to compare (default: all available)"),
      },
    },
    async ({ period1_start, period1_end, period2_start, period2_end, metrics }) => {
      try {
        // Fetch data for both periods in parallel
        const [sleep1, sleep2, readiness1, readiness2, activity1, activity2, scores1, scores2] = await Promise.all([
          client.getSleep(period1_start, period1_end),
          client.getSleep(period2_start, period2_end),
          client.getDailyReadiness(period1_start, period1_end),
          client.getDailyReadiness(period2_start, period2_end),
          client.getDailyActivity(period1_start, period1_end),
          client.getDailyActivity(period2_start, period2_end),
          client.getDailySleep(period1_start, period1_end),
          client.getDailySleep(period2_start, period2_end),
        ]);

        // Filter to main sleep sessions only
        const sessions1 = sleep1.data.filter((s) => s.type === "long_sleep");
        const sessions2 = sleep2.data.filter((s) => s.type === "long_sleep");

        const allMetrics = ["sleep_duration", "sleep_score", "deep_sleep", "rem_sleep", "hrv", "heart_rate", "efficiency", "readiness", "activity", "steps"];
        const metricsToCompare = metrics || allMetrics;

        type ComparisonRow = { metric: string; period1: string; period2: string; change: string; arrow: string };
        const comparisons: ComparisonRow[] = [];

        // Helper to calculate comparison
        const addComparison = (name: string, values1: number[], values2: number[], unit: string, decimals = 0) => {
          if (values1.length === 0 || values2.length === 0) return;
          const avg1 = mean(values1);
          const avg2 = mean(values2);
          const change = avg2 !== 0 ? ((avg1 - avg2) / avg2) * 100 : 0;
          const arrow = change > 2 ? "↑" : change < -2 ? "↓" : "→";
          comparisons.push({
            metric: name,
            period1: decimals > 0 ? `${avg1.toFixed(decimals)}${unit}` : `${Math.round(avg1)}${unit}`,
            period2: decimals > 0 ? `${avg2.toFixed(decimals)}${unit}` : `${Math.round(avg2)}${unit}`,
            change: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
            arrow,
          });
        };

        if (metricsToCompare.includes("sleep_duration")) {
          const durations1 = sessions1.map((s) => (s.total_sleep_duration ?? 0) / 3600);
          const durations2 = sessions2.map((s) => (s.total_sleep_duration ?? 0) / 3600);
          addComparison("Sleep Duration", durations1, durations2, "h", 1);
        }

        if (metricsToCompare.includes("sleep_score")) {
          const scores1Vals = scores1.data.filter((s) => s.score != null).map((s) => s.score!);
          const scores2Vals = scores2.data.filter((s) => s.score != null).map((s) => s.score!);
          addComparison("Sleep Score", scores1Vals, scores2Vals, "");
        }

        if (metricsToCompare.includes("deep_sleep")) {
          const deep1 = sessions1.filter((s) => s.deep_sleep_duration != null).map((s) => s.deep_sleep_duration! / 3600);
          const deep2 = sessions2.filter((s) => s.deep_sleep_duration != null).map((s) => s.deep_sleep_duration! / 3600);
          addComparison("Deep Sleep", deep1, deep2, "h", 1);
        }

        if (metricsToCompare.includes("rem_sleep")) {
          const rem1 = sessions1.filter((s) => s.rem_sleep_duration != null).map((s) => s.rem_sleep_duration! / 3600);
          const rem2 = sessions2.filter((s) => s.rem_sleep_duration != null).map((s) => s.rem_sleep_duration! / 3600);
          addComparison("REM Sleep", rem1, rem2, "h", 1);
        }

        if (metricsToCompare.includes("hrv")) {
          const hrv1 = sessions1.filter((s) => s.average_hrv != null).map((s) => s.average_hrv!);
          const hrv2 = sessions2.filter((s) => s.average_hrv != null).map((s) => s.average_hrv!);
          addComparison("HRV", hrv1, hrv2, " ms");
        }

        if (metricsToCompare.includes("heart_rate")) {
          const hr1 = sessions1.filter((s) => s.average_heart_rate != null).map((s) => s.average_heart_rate!);
          const hr2 = sessions2.filter((s) => s.average_heart_rate != null).map((s) => s.average_heart_rate!);
          addComparison("Resting HR", hr1, hr2, " bpm");
        }

        if (metricsToCompare.includes("efficiency")) {
          const eff1 = sessions1.filter((s) => s.efficiency != null).map((s) => s.efficiency!);
          const eff2 = sessions2.filter((s) => s.efficiency != null).map((s) => s.efficiency!);
          addComparison("Efficiency", eff1, eff2, "%");
        }

        if (metricsToCompare.includes("readiness")) {
          const read1 = readiness1.data.filter((r) => r.score != null).map((r) => r.score!);
          const read2 = readiness2.data.filter((r) => r.score != null).map((r) => r.score!);
          addComparison("Readiness", read1, read2, "");
        }

        if (metricsToCompare.includes("activity")) {
          const act1 = activity1.data.filter((a) => a.score != null).map((a) => a.score!);
          const act2 = activity2.data.filter((a) => a.score != null).map((a) => a.score!);
          addComparison("Activity", act1, act2, "");
        }

        if (metricsToCompare.includes("steps")) {
          const steps1 = activity1.data.map((a) => a.steps);
          const steps2 = activity2.data.map((a) => a.steps);
          addComparison("Steps", steps1, steps2, "");
        }

        if (comparisons.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No data available for comparison in the specified periods." }],
          };
        }

        const lines = [
          `## Period Comparison`,
          "",
          `**Period 1:** ${period1_start} to ${period1_end}`,
          `**Period 2:** ${period2_start} to ${period2_end}`,
          "",
          "| Metric | Period 1 | Period 2 | Change |",
          "|--------|----------|----------|--------|",
        ];

        comparisons.forEach((c) => {
          lines.push(`| ${c.metric} | ${c.period1} | ${c.period2} | ${c.arrow} ${c.change} |`);
        });

        // Summary
        const improvements = comparisons.filter((c) => c.arrow === "↑").length;
        const declines = comparisons.filter((c) => c.arrow === "↓").length;
        lines.push("");
        if (improvements > declines) {
          lines.push(`→ Period 1 shows overall improvement (${improvements} metrics up, ${declines} down)`);
        } else if (declines > improvements) {
          lines.push(`→ Period 1 shows some decline (${improvements} metrics up, ${declines} down)`);
        } else {
          lines.push(`→ Periods are relatively similar`);
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

  // ─────────────────────────────────────────────────────────────
  // compare_conditions tool
  // ─────────────────────────────────────────────────────────────

  // Auto-tracked conditions that don't require manual tags
  const AUTO_CONDITIONS = ["workout", "high_activity", "low_activity", "meditation", "session"] as const;
  type AutoCondition = typeof AUTO_CONDITIONS[number];

  server.registerTool(
    "compare_conditions",
    {
      description:
        "Compare a health metric across different conditions. Supports manual tags (alcohol, caffeine) AND auto-tracked conditions: 'workout' (workout days vs rest days), 'high_activity' (high step days), 'meditation' (session days).",
      inputSchema: {
        tag: z.string().describe("Condition to compare. Manual tags: 'alcohol', 'caffeine', 'late_meal'. Auto-tracked: 'workout', 'high_activity', 'meditation'."),
        metric: z.enum(["sleep_duration", "sleep_score", "deep_sleep", "rem_sleep", "hrv", "heart_rate", "efficiency", "readiness"]).describe("Metric to compare"),
        days: z.number().optional().describe("Number of days to analyze (default: 90)"),
      },
    },
    async ({ tag, metric, days = 90 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);
        const tagLower = tag.toLowerCase() as AutoCondition;
        const isAutoCondition = AUTO_CONDITIONS.includes(tagLower as AutoCondition);

        // Fetch sleep and readiness data (always needed)
        const [sleepResult, scoresResult, readinessResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailySleep(startDate, endDate),
          client.getDailyReadiness(startDate, endDate),
        ]);

        const allSleep = sleepResult.status === "fulfilled" ? sleepResult.value.data : [];
        const sessions = allSleep.filter((s) => s.type === "long_sleep");
        const scores = scoresResult.status === "fulfilled" ? scoresResult.value.data : [];
        const readiness = readinessResult.status === "fulfilled" ? readinessResult.value.data : [];

        const daysWithTag = new Set<string>();
        let conditionLabel = tag;

        if (isAutoCondition) {
          // Handle auto-tracked conditions
          if (tagLower === "workout") {
            const workoutsResult = await client.getWorkouts(startDate, endDate);
            workoutsResult.data.forEach((w) => daysWithTag.add(w.day));
            conditionLabel = "workout";
          } else if (tagLower === "meditation" || tagLower === "session") {
            const sessionsResult = await client.getSessions(startDate, endDate);
            sessionsResult.data.forEach((s) => daysWithTag.add(s.day));
            conditionLabel = "meditation/session";
          } else if (tagLower === "high_activity" || tagLower === "low_activity") {
            const activityResult = await client.getDailyActivity(startDate, endDate);
            const activities = activityResult.data;
            if (activities.length >= 5) {
              const allSteps = activities.map((a) => a.steps ?? 0).filter((s) => s > 0);
              const avgSteps = mean(allSteps);
              activities.forEach((a) => {
                const steps = a.steps ?? 0;
                if (tagLower === "high_activity" && steps > avgSteps * 1.2) {
                  daysWithTag.add(a.day);
                } else if (tagLower === "low_activity" && steps < avgSteps * 0.8) {
                  daysWithTag.add(a.day);
                }
              });
              conditionLabel = tagLower === "high_activity" ? "high activity (>20% above avg)" : "low activity (<20% below avg)";
            }
          }

          if (daysWithTag.size === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No ${conditionLabel} days found in the past ${days} days. Try a longer time period or check that you have ${tagLower === "workout" ? "workouts" : tagLower === "meditation" || tagLower === "session" ? "meditation sessions" : "activity data"} recorded.`,
                },
              ],
            };
          }
        } else {
          // Handle manual tags
          const [enhancedTagsResult, regularTagsResult] = await Promise.allSettled([
            client.getEnhancedTags(startDate, endDate),
            client.getTags(startDate, endDate),
          ]);

          const enhancedTags = enhancedTagsResult.status === "fulfilled" ? enhancedTagsResult.value.data : [];
          const regularTags = regularTagsResult.status === "fulfilled" ? regularTagsResult.value.data : [];

          if (enhancedTags.length === 0 && regularTags.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No tags found in the past ${days} days. Tags are manual lifestyle notes you add in the Oura app—try tracking alcohol, caffeine, late meals, or stress. Or use auto-tracked conditions: 'workout', 'high_activity', 'meditation'.`,
                },
              ],
            };
          }

          // Find days with the specified tag
          for (const t of enhancedTags) {
            const customMatch = t.custom_name?.toLowerCase().includes(tagLower);
            const codeMatch = t.tag_type_code?.toLowerCase().includes(tagLower);
            if (customMatch || codeMatch) {
              daysWithTag.add(t.start_day);
            }
          }

          for (const t of regularTags) {
            for (const tagName of t.tags) {
              if (tagName.toLowerCase().includes(tagLower)) {
                daysWithTag.add(t.day);
              }
            }
          }

          if (daysWithTag.size === 0) {
            const allTagNames = new Set<string>();
            enhancedTags.forEach((t) => allTagNames.add(t.custom_name || t.tag_type_code || "unknown"));
            regularTags.forEach((t) => t.tags.forEach((name) => allTagNames.add(name)));
            const tagList = [...allTagNames].join(", ") || "none";

            return {
              content: [
                {
                  type: "text" as const,
                  text: `No "${tag}" tags found. Available tags: ${tagList}. Auto-tracked options: workout, high_activity, meditation.`,
                },
              ],
            };
          }
        }

        // Create lookup maps
        const sleepByDay = new Map(sessions.map((s) => [s.day, s]));
        const scoresByDay = new Map(scores.map((s) => [s.day, s]));
        const readinessByDay = new Map(readiness.map((r) => [r.day, r]));

        // Get metric values for days with and without tag
        const getMetricValue = (day: string): number | null => {
          const sleep = sleepByDay.get(day);
          const score = scoresByDay.get(day);
          const read = readinessByDay.get(day);

          switch (metric) {
            case "sleep_duration":
              return sleep?.total_sleep_duration ? sleep.total_sleep_duration / 3600 : null;
            case "sleep_score":
              return score?.score ?? null;
            case "deep_sleep":
              return sleep?.deep_sleep_duration ? sleep.deep_sleep_duration / 3600 : null;
            case "rem_sleep":
              return sleep?.rem_sleep_duration ? sleep.rem_sleep_duration / 3600 : null;
            case "hrv":
              return sleep?.average_hrv ?? null;
            case "heart_rate":
              return sleep?.average_heart_rate ?? null;
            case "efficiency":
              return sleep?.efficiency ?? null;
            case "readiness":
              return read?.score ?? null;
            default:
              return null;
          }
        };

        const withTagValues: number[] = [];
        const withoutTagValues: number[] = [];

        // Get all days with data
        const allDays = new Set([...sessions.map((s) => s.day), ...scores.map((s) => s.day), ...readiness.map((r) => r.day)]);

        for (const day of allDays) {
          const value = getMetricValue(day);
          if (value === null) continue;

          if (daysWithTag.has(day)) {
            withTagValues.push(value);
          } else {
            withoutTagValues.push(value);
          }
        }

        if (withTagValues.length < 2 || withoutTagValues.length < 2) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Not enough data to compare. Found ${withTagValues.length} days with "${tag}" and ${withoutTagValues.length} days without.`,
              },
            ],
          };
        }

        const avgWith = mean(withTagValues);
        const avgWithout = mean(withoutTagValues);
        const difference = avgWith - avgWithout;
        const percentDiff = (difference / avgWithout) * 100;

        const metricLabels: Record<string, { name: string; unit: string; decimals: number; higherIsBetter: boolean }> = {
          sleep_duration: { name: "Sleep Duration", unit: "h", decimals: 1, higherIsBetter: true },
          sleep_score: { name: "Sleep Score", unit: "", decimals: 0, higherIsBetter: true },
          deep_sleep: { name: "Deep Sleep", unit: "h", decimals: 1, higherIsBetter: true },
          rem_sleep: { name: "REM Sleep", unit: "h", decimals: 1, higherIsBetter: true },
          hrv: { name: "HRV", unit: " ms", decimals: 0, higherIsBetter: true },
          heart_rate: { name: "Resting HR", unit: " bpm", decimals: 0, higherIsBetter: false },
          efficiency: { name: "Efficiency", unit: "%", decimals: 0, higherIsBetter: true },
          readiness: { name: "Readiness", unit: "", decimals: 0, higherIsBetter: true },
        };

        const m = metricLabels[metric];
        const formatVal = (v: number) => (m.decimals > 0 ? v.toFixed(m.decimals) : Math.round(v).toString()) + m.unit;

        const lines = [
          `## Condition Comparison: ${conditionLabel}`,
          "",
          `**Metric:** ${m.name}`,
          `**Period:** Last ${days} days`,
          "",
          `| Condition | Avg ${m.name} | Days |`,
          `|-----------|${"-".repeat(m.name.length + 6)}|------|`,
          `| With ${conditionLabel} | ${formatVal(avgWith)} | ${withTagValues.length} |`,
          `| Without ${conditionLabel} | ${formatVal(avgWithout)} | ${withoutTagValues.length} |`,
          "",
          `**Difference:** ${difference >= 0 ? "+" : ""}${formatVal(difference)} (${percentDiff >= 0 ? "+" : ""}${percentDiff.toFixed(0)}%)`,
          "",
        ];

        // Interpretation
        const isBetter = m.higherIsBetter ? difference > 0 : difference < 0;
        const isWorse = m.higherIsBetter ? difference < 0 : difference > 0;
        const isSignificant = Math.abs(percentDiff) > 5;

        if (isSignificant && isWorse) {
          lines.push(`⚠ ${conditionLabel} appears to negatively impact your ${m.name.toLowerCase()}.`);
        } else if (isSignificant && isBetter) {
          lines.push(`✓ ${conditionLabel} appears to positively impact your ${m.name.toLowerCase()}.`);
        } else {
          lines.push(`→ ${conditionLabel} doesn't show a significant impact on your ${m.name.toLowerCase()}.`);
        }

        lines.push("");
        lines.push("*Note: Correlation doesn't imply causation. Other factors may be involved.*");

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
