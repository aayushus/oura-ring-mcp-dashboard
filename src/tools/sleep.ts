import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OuraClient,
  SleepSession,
  DailySleep,
  DailyActivity,
  SleepTime,
} from "../client.js";
import {
  formatDuration,
  formatTime,
  formatScore,
  getToday,
  getDaysAgo,
  percentage,
  formatError,
  mean,
  trend,
  detectOutliers,
  dispersion,
  rollingAverages,
  dayOfWeekAnalysis,
  sleepDebt,
  sleepRegularity,
  hrvRecoveryPattern,
} from "../utils/index.js";

// ─────────────────────────────────────────────────────────────
// Formatting helpers (sleep-specific)
// ─────────────────────────────────────────────────────────────

export function formatSleepSession(session: SleepSession, dailyScore?: DailySleep): string {
  // Handle null values with defaults
  const totalSleep = session.total_sleep_duration ?? 0;
  const timeInBed = session.time_in_bed ?? 0;
  const deepSleep = session.deep_sleep_duration ?? 0;
  const remSleep = session.rem_sleep_duration ?? 0;
  const lightSleep = session.light_sleep_duration ?? 0;
  const awakeTime = session.awake_time ?? 0;

  const efficiency = percentage(totalSleep, timeInBed);

  const lines = [
    `## Sleep: ${session.day}`,
  ];

  // Include score from daily_sleep if available
  if (dailyScore?.score != null) {
    lines.push(`**Score:** ${formatScore(dailyScore.score)}`);
  }

  lines.push(
    `**Bedtime:** ${formatTime(session.bedtime_start)} → ${formatTime(session.bedtime_end)}`,
    `**Total Sleep:** ${formatDuration(totalSleep)} (of ${formatDuration(timeInBed)} in bed)`,
    `**Efficiency:** ${efficiency}%`,
    "",
    "**Sleep Stages:**",
    `- Deep: ${formatDuration(deepSleep)} (${percentage(deepSleep, totalSleep)}%)`,
    `- REM: ${formatDuration(remSleep)} (${percentage(remSleep, totalSleep)}%)`,
    `- Light: ${formatDuration(lightSleep)} (${percentage(lightSleep, totalSleep)}%)`,
    `- Awake: ${formatDuration(awakeTime)}`,
  );

  // Add restless periods if available
  if (session.restless_periods != null) {
    lines.push(`- Restless Periods: ${session.restless_periods}`);
  }

  // Add biometrics if available
  if (session.average_heart_rate || session.average_hrv) {
    lines.push("");
    lines.push("**Biometrics:**");
    if (session.average_heart_rate) {
      lines.push(
        `- Avg Heart Rate: ${session.average_heart_rate} bpm (lowest: ${session.lowest_heart_rate})`
      );
    }
    if (session.average_hrv) {
      lines.push(`- Avg HRV: ${session.average_hrv} ms`);
    }
    if (session.average_breath) {
      lines.push(`- Avg Breathing Rate: ${session.average_breath} breaths/min`);
    }
  }

  if (session.latency) {
    lines.push(`\n**Sleep Latency:** ${formatDuration(session.latency)} to fall asleep`);
  }

  return lines.join("\n");
}

export function formatDailySleep(day: DailySleep): string {
  const c = day.contributors;
  return [
    `## Daily Sleep Score: ${day.day}`,
    `**Score:** ${formatScore(day.score ?? null)}`,
    "",
    "**Contributors:**",
    `- Total Sleep: ${c.total_sleep ?? "N/A"}`,
    `- Efficiency: ${c.efficiency ?? "N/A"}`,
    `- Restfulness: ${c.restfulness ?? "N/A"}`,
    `- REM Sleep: ${c.rem_sleep ?? "N/A"}`,
    `- Deep Sleep: ${c.deep_sleep ?? "N/A"}`,
    `- Latency: ${c.latency ?? "N/A"}`,
    `- Timing: ${c.timing ?? "N/A"}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────
// Register Sleep Tools
// ─────────────────────────────────────────────────────────────

export function registerSleepTools(server: McpServer, client: OuraClient) {
  // ─────────────────────────────────────────────────────────────
  // get_sleep tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_sleep",
    {
      description:
        "Get detailed sleep data for a date range. Returns sleep duration, stages (deep/REM/light), efficiency, heart rate, and HRV. Use this for analyzing sleep patterns and quality.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today if not specified."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date if not specified."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        // Fetch both detailed sessions AND daily scores in parallel
        const [sessionsResult, scoresResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailySleep(startDate, endDate),
        ]);

        const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value.data : [];
        const scores = scoresResult.status === "fulfilled" ? scoresResult.value.data : [];

        if (sessions.length === 0 && scores.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No sleep data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        // Create a map of day -> score for easy lookup
        const scoresByDay = new Map(scores.map((s) => [s.day, s]));

        // Format each sleep session with its corresponding score
        const formatted = sessions.map((session) => {
          const dailyScore = scoresByDay.get(session.day);
          return formatSleepSession(session, dailyScore);
        });

        // If we have scores but no sessions (rare edge case), show scores only
        if (sessions.length === 0 && scores.length > 0) {
          const scoreOnlyFormatted = scores.map((day) => formatDailySleep(day));
          return {
            content: [
              {
                type: "text" as const,
                text: scoreOnlyFormatted.join("\n\n---\n\n"),
              },
            ],
          };
        }

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
  // get_daily_sleep tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_daily_sleep",
    {
      description:
        "Get daily sleep scores and contributors (efficiency, deep sleep, REM sleep, latency, timing, etc.). Different from get_sleep - this provides a single daily score with breakdown of what contributed to it. Use this for understanding sleep quality scoring.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getDailySleep(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No daily sleep data found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}.`,
              },
            ],
          };
        }

        const formatted = response.data.map((day) => formatDailySleep(day));

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
  // get_sleep_time tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_sleep_time",
    {
      description:
        "Get Oura's personalized bedtime recommendations. Shows your ideal bedtime window based on your sleep patterns and circadian rhythm.",
      inputSchema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to today."),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to start_date."),
      },
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = start_date || getToday();
        const endDate = end_date || startDate;

        const response = await client.getSleepTime(startDate, endDate);

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No sleep time recommendations found for ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}. Oura needs enough data to generate bedtime recommendations.`,
              },
            ],
          };
        }

        const formatted = response.data.map((st: SleepTime) => {
          const lines = [`## Bedtime Recommendation: ${st.day}`];

          if (st.recommendation === "improve_efficiency") {
            lines.push("**Status:** Working on improving sleep efficiency");
          } else if (st.recommendation === "earlier_bedtime") {
            lines.push("**Status:** Consider going to bed earlier");
          } else if (st.recommendation === "later_bedtime") {
            lines.push("**Status:** Consider going to bed later");
          } else if (st.recommendation === "follow_optimal_bedtime") {
            lines.push("**Status:** Following optimal bedtime");
          } else if (st.recommendation) {
            lines.push(`**Status:** ${st.recommendation}`);
          }

          if (st.optimal_bedtime?.day_tz) {
            lines.push("");
            lines.push("**Optimal Bedtime Window:**");
            const startTime = st.optimal_bedtime.start_offset !== undefined
              ? new Date(new Date(st.optimal_bedtime.day_tz).getTime() + st.optimal_bedtime.start_offset * 1000).toISOString()
              : undefined;
            const endTime = st.optimal_bedtime.end_offset !== undefined
              ? new Date(new Date(st.optimal_bedtime.day_tz).getTime() + st.optimal_bedtime.end_offset * 1000).toISOString()
              : undefined;
            lines.push(`- Start: ${startTime ? formatTime(startTime) : "N/A"}`);
            lines.push(`- End: ${endTime ? formatTime(endTime) : "N/A"}`);
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
  // analyze_sleep_quality tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "analyze_sleep_quality",
    {
      description:
        "Comprehensive sleep quality analysis over a time period. Shows trends, patterns by day of week, sleep debt, regularity score, and identifies your best/worst sleep days. Great for understanding what affects your sleep.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
      },
    },
    async ({ days = 30 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        const [sleepResult, scoresResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailySleep(startDate, endDate),
        ]);

        // Filter to only main sleep sessions (exclude naps, rest periods)
        const allSleep = sleepResult.status === "fulfilled" ? sleepResult.value.data : [];
        const sessions = allSleep.filter((s) => s.type === "long_sleep");
        const scores = scoresResult.status === "fulfilled" ? scoresResult.value.data : [];

        if (sessions.length < 3) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Need at least 3 nights of sleep data for analysis. Found ${sessions.length} night(s) in the past ${days} days.`,
              },
            ],
          };
        }

        const lines = [`## Sleep Quality Analysis (${days} days)`, ""];

        // Overall stats
        const durations = sessions.map((s) => s.total_sleep_duration ?? 0);
        const hrvValues = sessions.filter((s) => s.average_hrv != null).map((s) => s.average_hrv!);
        const efficiencies = sessions.filter((s) => s.efficiency != null).map((s) => s.efficiency!);

        const avgDuration = mean(durations);
        const avgHrv = hrvValues.length > 0 ? mean(hrvValues) : null;
        const avgEfficiency = efficiencies.length > 0 ? mean(efficiencies) : null;

        lines.push("### Overview");
        lines.push(`- **Nights analyzed:** ${sessions.length}`);
        lines.push(`- **Avg sleep:** ${formatDuration(avgDuration)}`);
        if (avgEfficiency) lines.push(`- **Avg efficiency:** ${Math.round(avgEfficiency)}%`);
        if (avgHrv) lines.push(`- **Avg HRV:** ${Math.round(avgHrv)} ms`);

        // Sleep debt
        const debt = sleepDebt(durations, 8);
        lines.push("");
        if (debt.status === "surplus") {
          lines.push(`✓ **Sleep surplus:** Getting ${Math.abs(debt.debtHours).toFixed(1)}h more than 8h target`);
        } else if (debt.status === "balanced") {
          lines.push(`✓ **On target:** Meeting 8h sleep goal`);
        } else if (debt.status === "mild_debt") {
          lines.push(`⚠ **Mild sleep debt:** ${debt.debtHours.toFixed(1)}h short of 8h target`);
        } else {
          lines.push(`⚠ **Significant sleep debt:** ${debt.debtHours.toFixed(1)}h short of 8h target`);
        }

        // Sleep regularity
        const bedtimes = sessions.map((s) => s.bedtime_start);
        const waketimes = sessions.map((s) => s.bedtime_end);
        const regularity = sleepRegularity(bedtimes, waketimes);
        lines.push(`- **Regularity score:** ${Math.round(regularity.regularityScore)}/100 (${regularity.status.replace(/_/g, " ")})`);

        // Trend analysis
        if (scores.length >= 5) {
          const scoreValues = scores.map((s) => s.score ?? 0);
          const scoreTrend = trend(scoreValues);
          lines.push("");
          lines.push("### Trend");
          if (scoreTrend.direction === "improving") {
            lines.push(`↑ Sleep scores are **improving** (${scoreTrend.significant ? "statistically significant" : "not yet significant"})`);
          } else if (scoreTrend.direction === "declining") {
            lines.push(`↓ Sleep scores are **declining** (${scoreTrend.significant ? "statistically significant" : "not yet significant"})`);
          } else {
            lines.push(`→ Sleep scores are **stable**`);
          }
        }

        // Rolling averages
        if (durations.length >= 7) {
          const rolling = rollingAverages(durations);
          lines.push("");
          lines.push("### Rolling Averages");
          lines.push(`- Last 7 days: ${formatDuration(rolling.day7.value)}`);
          if (durations.length >= 14) {
            lines.push(`- Last 14 days: ${formatDuration(rolling.day14.value)}`);
          }
          if (durations.length >= 30) {
            lines.push(`- Last 30 days: ${formatDuration(rolling.day30.value)}`);
          }
        }

        // Day of week patterns
        const dowData = sessions.map((s) => ({
          date: s.day,
          value: (s.total_sleep_duration ?? 0) / 3600, // hours
        }));
        const dowAnalysis = dayOfWeekAnalysis(dowData);
        lines.push("");
        lines.push("### Day of Week Patterns");
        lines.push(`- **Best night:** ${dowAnalysis.bestDay.day} (${dowAnalysis.bestDay.average.toFixed(1)}h avg)`);
        lines.push(`- **Worst night:** ${dowAnalysis.worstDay.day} (${dowAnalysis.worstDay.average.toFixed(1)}h avg)`);
        lines.push(`- **Weekday avg:** ${dowAnalysis.weekdayAverage.toFixed(1)}h`);
        lines.push(`- **Weekend avg:** ${dowAnalysis.weekendAverage.toFixed(1)}h`);

        // Variability
        const durationDispersion = dispersion(durations.map((d) => d / 3600));
        lines.push("");
        lines.push("### Variability");
        lines.push(`- **Range:** ${durationDispersion.min.toFixed(1)}h - ${durationDispersion.max.toFixed(1)}h`);
        lines.push(`- **Coefficient of variation:** ${durationDispersion.coefficientOfVariation.toFixed(0)}%`);
        if (durationDispersion.coefficientOfVariation > 20) {
          lines.push("  *(High variability - consider more consistent bedtimes)*");
        }

        // Best and worst nights
        const sortedByDuration = [...sessions].sort(
          (a, b) => (b.total_sleep_duration ?? 0) - (a.total_sleep_duration ?? 0)
        );
        lines.push("");
        lines.push("### Notable Nights");
        const best = sortedByDuration[0];
        const worst = sortedByDuration[sortedByDuration.length - 1];
        lines.push(`- **Best:** ${best.day} - ${formatDuration(best.total_sleep_duration ?? 0)}`);
        lines.push(`- **Worst:** ${worst.day} - ${formatDuration(worst.total_sleep_duration ?? 0)}`);

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
  // analyze_hrv_trend tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "analyze_hrv_trend",
    {
      description:
        "Analyze your HRV (Heart Rate Variability) trend over time. HRV is a key indicator of recovery and stress. Shows trend direction, rolling averages, and identifies recovery patterns.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 30)"),
      },
    },
    async ({ days = 30 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        const sleepResult = await client.getSleep(startDate, endDate);
        const sessions = sleepResult.data.filter((s) => s.type === "long_sleep" && s.average_hrv != null);

        if (sessions.length < 5) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Need at least 5 nights of HRV data for analysis. Found ${sessions.length} nights with HRV in the past ${days} days.`,
              },
            ],
          };
        }

        const hrvValues = sessions.map((s) => s.average_hrv!);
        const hrvData = sessions.map((s) => ({ date: s.day, value: s.average_hrv! }));

        const lines = [
          `## HRV Trend Analysis (${days} days)`,
          "",
        ];

        // Overall stats
        const stats = dispersion(hrvValues);
        lines.push("### Overview");
        lines.push(`- **Current HRV:** ${Math.round(hrvValues[hrvValues.length - 1])} ms`);
        lines.push(`- **Average:** ${Math.round(stats.mean)} ms`);
        lines.push(`- **Range:** ${Math.round(stats.min)} - ${Math.round(stats.max)} ms`);
        lines.push(`- **Variability (CV):** ${stats.coefficientOfVariation.toFixed(0)}%`);
        lines.push("");

        // Trend analysis
        const hrvTrend = trend(hrvValues);
        lines.push("### Trend");

        if (hrvTrend.direction === "improving") {
          lines.push(`↑ HRV is **increasing** over this period`);
          if (hrvTrend.significant) {
            lines.push(`  *(Statistically significant, p=${hrvTrend.pValue.toFixed(3)})*`);
          }
          lines.push("");
          lines.push("This suggests improving recovery and stress resilience.");
        } else if (hrvTrend.direction === "declining") {
          lines.push(`↓ HRV is **decreasing** over this period`);
          if (hrvTrend.significant) {
            lines.push(`  *(Statistically significant, p=${hrvTrend.pValue.toFixed(3)})*`);
          }
          lines.push("");
          lines.push("This may indicate accumulated stress, overtraining, or illness.");
        } else {
          lines.push(`→ HRV is **stable** over this period`);
          lines.push("");
          lines.push("Your recovery capacity is consistent.");
        }
        lines.push("");

        // Rolling averages
        if (hrvValues.length >= 7) {
          const rolling = rollingAverages(hrvValues);
          lines.push("### Rolling Averages");
          lines.push(`- Last 7 days: ${Math.round(rolling.day7.value)} ms`);
          if (hrvValues.length >= 14) {
            lines.push(`- Last 14 days: ${Math.round(rolling.day14.value)} ms`);
          }
          if (hrvValues.length >= 30) {
            lines.push(`- Last 30 days: ${Math.round(rolling.day30.value)} ms`);
          }
          lines.push("");

          // Short vs long term comparison
          if (hrvValues.length >= 14) {
            const shortTerm = rolling.day7.value;
            const longTerm = hrvValues.length >= 30 ? rolling.day30.value : rolling.day14.value;
            const diff = ((shortTerm - longTerm) / longTerm) * 100;

            if (diff > 5) {
              lines.push(`✓ Recent HRV is ${diff.toFixed(0)}% above baseline - good recovery.`);
            } else if (diff < -5) {
              lines.push(`⚠ Recent HRV is ${Math.abs(diff).toFixed(0)}% below baseline - may need more recovery.`);
            } else {
              lines.push(`→ Recent HRV is close to baseline.`);
            }
            lines.push("");
          }
        }

        // Day of week patterns
        const dowAnalysis = dayOfWeekAnalysis(hrvData);
        lines.push("### Weekly Pattern");
        lines.push(`- **Best HRV:** ${dowAnalysis.bestDay.day} (avg ${Math.round(dowAnalysis.bestDay.average)} ms)`);
        lines.push(`- **Lowest HRV:** ${dowAnalysis.worstDay.day} (avg ${Math.round(dowAnalysis.worstDay.average)} ms)`);
        lines.push(`- **Weekday avg:** ${Math.round(dowAnalysis.weekdayAverage)} ms`);
        lines.push(`- **Weekend avg:** ${Math.round(dowAnalysis.weekendAverage)} ms`);

        // Outliers
        const outliers = detectOutliers(hrvValues);
        if (outliers.outliers.length > 0) {
          lines.push("");
          lines.push("### Unusual Nights");
          outliers.outliers.forEach((o) => {
            const session = sessions[o.index];
            const direction = o.value < stats.mean ? "low" : "high";
            lines.push(`- ${session.day}: ${Math.round(o.value)} ms (unusually ${direction})`);
          });
        }

        // Most recent night's HRV recovery pattern
        const mostRecent = sessions[sessions.length - 1];
        const hrvSamples = mostRecent.hrv?.items?.filter((v: number | null): v is number => v !== null) ?? [];
        if (hrvSamples.length >= 4) {
          const recovery = hrvRecoveryPattern(hrvSamples);
          if (recovery.pattern !== "insufficient_data") {
            lines.push("");
            lines.push("### Last Night's Recovery Pattern");
            lines.push(`- **Pattern:** ${recovery.pattern.replace(/_/g, " ")}`);
            lines.push(`- First half avg: ${recovery.firstHalfAvg} ms`);
            lines.push(`- Second half avg: ${recovery.secondHalfAvg} ms`);
            lines.push(`- ${recovery.interpretation}`);
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

  // ─────────────────────────────────────────────────────────────
  // best_sleep_conditions tool
  // ─────────────────────────────────────────────────────────────
  server.registerTool(
    "best_sleep_conditions",
    {
      description:
        "Analyze what conditions are associated with your best sleep nights. Looks at activity levels, workouts, meditation sessions, tags, and day-of-week patterns to identify what predicts good vs poor sleep.",
      inputSchema: {
        days: z.number().optional().describe("Number of days to analyze (default: 60)"),
      },
    },
    async ({ days = 60 }) => {
      try {
        const endDate = getToday();
        const startDate = getDaysAgo(days);

        // Fetch all relevant data (including tags, workouts, and sessions)
        const [sleepResult, scoresResult, activityResult, enhancedTagsResult, regularTagsResult, workoutsResult, meditationResult] = await Promise.allSettled([
          client.getSleep(startDate, endDate),
          client.getDailySleep(startDate, endDate),
          client.getDailyActivity(startDate, endDate),
          client.getEnhancedTags(startDate, endDate),
          client.getTags(startDate, endDate),
          client.getWorkouts(startDate, endDate),
          client.getSessions(startDate, endDate),
        ]);

        const allSleep = sleepResult.status === "fulfilled" ? sleepResult.value.data : [];
        const sessions = allSleep.filter((s) => s.type === "long_sleep");
        const scores = scoresResult.status === "fulfilled" ? scoresResult.value.data : [];
        const activity = activityResult.status === "fulfilled" ? activityResult.value.data : [];
        const enhancedTags = enhancedTagsResult.status === "fulfilled" ? enhancedTagsResult.value.data : [];
        const regularTags = regularTagsResult.status === "fulfilled" ? regularTagsResult.value.data : [];
        const workouts = workoutsResult.status === "fulfilled" ? workoutsResult.value.data : [];
        const meditationSessions = meditationResult.status === "fulfilled" ? meditationResult.value.data : [];

        // Create sets for auto-tracked conditions
        const workoutDays = new Set(workouts.map((w) => w.day));
        const meditationDays = new Set(meditationSessions.map((s) => s.day));

        if (sessions.length < 10) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Need at least 10 nights of sleep data for meaningful analysis. Found ${sessions.length} nights in the past ${days} days.`,
              },
            ],
          };
        }

        // Create lookup maps
        const scoresByDay = new Map(scores.map((s) => [s.day, s.score ?? 0]));
        const activityByDay = new Map(activity.map((a) => [a.day, a]));

        // Combine enhanced tags and regular tags into tagsByDay
        const tagsByDay = new Map<string, string[]>();
        enhancedTags.forEach((t) => {
          const existing = tagsByDay.get(t.start_day) || [];
          existing.push(t.custom_name || t.tag_type_code || "unknown");
          tagsByDay.set(t.start_day, existing);
        });
        regularTags.forEach((t) => {
          const existing = tagsByDay.get(t.day) || [];
          existing.push(...t.tags);
          tagsByDay.set(t.day, existing);
        });

        // Classify nights as good, average, or poor based on sleep score quartiles
        const allScores = sessions.map((s) => scoresByDay.get(s.day) ?? 0).filter((s) => s > 0);
        if (allScores.length < 10) {
          return {
            content: [{ type: "text" as const, text: "Not enough sleep score data for analysis." }],
          };
        }

        const sortedScores = [...allScores].sort((a, b) => a - b);
        const q25 = sortedScores[Math.floor(sortedScores.length * 0.25)];
        const q75 = sortedScores[Math.floor(sortedScores.length * 0.75)];

        type NightData = { day: string; score: number; activity: DailyActivity | undefined; tags: string[]; hadWorkout: boolean; hadMeditation: boolean };
        const goodNights: NightData[] = [];
        const poorNights: NightData[] = [];

        sessions.forEach((s) => {
          const score = scoresByDay.get(s.day) ?? 0;
          if (score === 0) return;

          const data: NightData = {
            day: s.day,
            score,
            activity: activityByDay.get(s.day),
            tags: tagsByDay.get(s.day) || [],
            hadWorkout: workoutDays.has(s.day),
            hadMeditation: meditationDays.has(s.day),
          };

          if (score >= q75) {
            goodNights.push(data);
          } else if (score <= q25) {
            poorNights.push(data);
          }
        });

        const lines = [
          `## Best Sleep Conditions Analysis`,
          "",
          `*Based on ${sessions.length} nights over ${days} days*`,
          "",
          `**Sleep Score Thresholds:**`,
          `- Good nights (top 25%): score ≥ ${q75}`,
          `- Poor nights (bottom 25%): score ≤ ${q25}`,
          "",
        ];

        // Activity comparison
        const goodActivity = goodNights.filter((n) => n.activity).map((n) => n.activity!);
        const poorActivity = poorNights.filter((n) => n.activity).map((n) => n.activity!);

        if (goodActivity.length >= 3 && poorActivity.length >= 3) {
          lines.push("### Activity Patterns");
          lines.push("");

          const avgGoodSteps = mean(goodActivity.map((a) => a.steps));
          const avgPoorSteps = mean(poorActivity.map((a) => a.steps));
          const avgGoodCal = mean(goodActivity.map((a) => a.active_calories));
          const avgPoorCal = mean(poorActivity.map((a) => a.active_calories));

          lines.push("| Metric | Good Nights | Poor Nights |");
          lines.push("|--------|-------------|-------------|");
          lines.push(`| Steps | ${Math.round(avgGoodSteps).toLocaleString()} | ${Math.round(avgPoorSteps).toLocaleString()} |`);
          lines.push(`| Active Calories | ${Math.round(avgGoodCal)} | ${Math.round(avgPoorCal)} |`);
          lines.push("");

          const stepsDiff = ((avgGoodSteps - avgPoorSteps) / avgPoorSteps) * 100;
          if (Math.abs(stepsDiff) > 10) {
            if (stepsDiff > 0) {
              lines.push(`→ Good sleep nights have ${stepsDiff.toFixed(0)}% more steps on average.`);
            } else {
              lines.push(`→ Good sleep nights have ${Math.abs(stepsDiff).toFixed(0)}% fewer steps on average.`);
            }
          }
          lines.push("");
        }

        // Auto-tracked conditions analysis (workouts and meditation)
        const workoutGood = goodNights.filter((n) => n.hadWorkout).length;
        const workoutPoor = poorNights.filter((n) => n.hadWorkout).length;
        const meditationGood = goodNights.filter((n) => n.hadMeditation).length;
        const meditationPoor = poorNights.filter((n) => n.hadMeditation).length;

        const hasWorkoutData = workoutGood + workoutPoor >= 3;
        const hasMeditationData = meditationGood + meditationPoor >= 3;

        if (hasWorkoutData || hasMeditationData) {
          lines.push("### Auto-Tracked Conditions");
          lines.push("");
          lines.push("| Condition | Good Nights | Poor Nights | Good Rate |");
          lines.push("|-----------|-------------|-------------|-----------|");

          if (hasWorkoutData) {
            const workoutGoodRate = workoutGood / (workoutGood + workoutPoor);
            lines.push(`| Workout | ${workoutGood} | ${workoutPoor} | ${(workoutGoodRate * 100).toFixed(0)}% |`);
          }
          if (hasMeditationData) {
            const meditationGoodRate = meditationGood / (meditationGood + meditationPoor);
            lines.push(`| Meditation/Session | ${meditationGood} | ${meditationPoor} | ${(meditationGoodRate * 100).toFixed(0)}% |`);
          }
          lines.push("");

          // Insights
          if (hasWorkoutData) {
            const workoutGoodRate = workoutGood / (workoutGood + workoutPoor);
            if (workoutGoodRate > 0.6) {
              lines.push(`✓ Workouts are associated with good sleep (${(workoutGoodRate * 100).toFixed(0)}% good nights)`);
            } else if (workoutGoodRate < 0.4) {
              lines.push(`⚠ Workouts may be affecting your sleep negatively (${((1 - workoutGoodRate) * 100).toFixed(0)}% poor nights)`);
            }
          }
          if (hasMeditationData) {
            const meditationGoodRate = meditationGood / (meditationGood + meditationPoor);
            if (meditationGoodRate > 0.6) {
              lines.push(`✓ Meditation/sessions are associated with good sleep (${(meditationGoodRate * 100).toFixed(0)}% good nights)`);
            } else if (meditationGoodRate < 0.4) {
              lines.push(`→ Meditation/sessions don't show a clear positive pattern yet`);
            }
          }
          lines.push("");
        }

        // Tag analysis
        const allTags = new Map<string, { good: number; poor: number; total: number }>();
        goodNights.forEach((n) => {
          n.tags.forEach((tag) => {
            const existing = allTags.get(tag) || { good: 0, poor: 0, total: 0 };
            existing.good++;
            existing.total++;
            allTags.set(tag, existing);
          });
        });
        poorNights.forEach((n) => {
          n.tags.forEach((tag) => {
            const existing = allTags.get(tag) || { good: 0, poor: 0, total: 0 };
            existing.poor++;
            existing.total++;
            allTags.set(tag, existing);
          });
        });

        const significantTags = [...allTags.entries()]
          .filter(([, data]) => data.total >= 3)
          .map(([tag, data]) => ({
            tag,
            ...data,
            goodRate: data.good / (data.good + data.poor),
          }))
          .sort((a, b) => b.goodRate - a.goodRate);

        if (significantTags.length > 0) {
          lines.push("### Tag Impact");
          lines.push("");
          lines.push("| Tag | Good Nights | Poor Nights | Good Rate |");
          lines.push("|-----|-------------|-------------|-----------|");

          significantTags.forEach((t) => {
            lines.push(`| ${t.tag} | ${t.good} | ${t.poor} | ${(t.goodRate * 100).toFixed(0)}% |`);
          });
          lines.push("");

          // Find best and worst tags
          if (significantTags.length >= 2) {
            const bestTag = significantTags[0];
            const worstTag = significantTags[significantTags.length - 1];

            if (bestTag.goodRate > 0.6) {
              lines.push(`✓ "${bestTag.tag}" is associated with good sleep (${(bestTag.goodRate * 100).toFixed(0)}% good nights)`);
            }
            if (worstTag.goodRate < 0.4) {
              lines.push(`⚠ "${worstTag.tag}" is associated with poor sleep (${((1 - worstTag.goodRate) * 100).toFixed(0)}% poor nights)`);
            }
          }
          lines.push("");
        }

        // Day of week patterns
        const dowGood = new Map<number, number>();
        const dowPoor = new Map<number, number>();
        const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        goodNights.forEach((n) => {
          const d = new Date(n.day);
          const dow = n.day.includes("T") ? d.getDay() : d.getUTCDay();
          dowGood.set(dow, (dowGood.get(dow) || 0) + 1);
        });
        poorNights.forEach((n) => {
          const d = new Date(n.day);
          const dow = n.day.includes("T") ? d.getDay() : d.getUTCDay();
          dowPoor.set(dow, (dowPoor.get(dow) || 0) + 1);
        });

        lines.push("### Day of Week");
        lines.push("");

        let bestDay = -1;
        let bestDayRate = 0;
        let worstDay = -1;
        let worstDayRate = 1;

        for (let dow = 0; dow < 7; dow++) {
          const good = dowGood.get(dow) || 0;
          const poor = dowPoor.get(dow) || 0;
          if (good + poor >= 2) {
            const rate = good / (good + poor);
            if (rate > bestDayRate) {
              bestDayRate = rate;
              bestDay = dow;
            }
            if (rate < worstDayRate) {
              worstDayRate = rate;
              worstDay = dow;
            }
          }
        }

        if (bestDay >= 0 && worstDay >= 0 && bestDay !== worstDay) {
          lines.push(`- Best sleep: **${dowNames[bestDay]}** nights (${(bestDayRate * 100).toFixed(0)}% good)`);
          lines.push(`- Worst sleep: **${dowNames[worstDay]}** nights (${((1 - worstDayRate) * 100).toFixed(0)}% poor)`);
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
