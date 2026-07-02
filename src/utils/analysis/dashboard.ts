/**
 * Advanced Dashboard Analysis Utilities
 */

import { SleepRecord, ReadinessRecord, ActivityRecord, StressRecord } from "../../db.js";
import { mean, standardDeviation } from "./statistics.js";

// Helper to compute rolling average
function getRollingAverage(values: number[], index: number, windowSize: number): number {
  const start = Math.max(0, index - windowSize + 1);
  const subset = values.slice(start, index + 1);
  return mean(subset);
}

/**
 * Calculate Sleep Debt Trend (C2.6)
 * Sleep debt = cumulative sum of (sleep_need - total_sleep_duration)
 */
export function calculateSleepDebt(
  sleepRecords: SleepRecord[],
  sleepNeedSeconds: number
): Array<{ day: string; debt: number }> {
  // Sort ascending chronologically
  const sorted = [...sleepRecords].sort((a, b) => a.day.localeCompare(b.day));
  let runningDebt = 0;

  return sorted.map((record) => {
    // sleepNeed - record.duration
    const diff = sleepNeedSeconds - record.duration;
    runningDebt += diff;
    // Convert to hours for dashboard display
    return {
      day: record.day,
      debt: Number((runningDebt / 3600).toFixed(2)),
    };
  });
}

/**
 * Calculate Acute:Chronic Workload Ratio (ACWR) (C4.5)
 * Acute workload = 7-day rolling average of active calories
 * Chronic workload = 28-day rolling average of active calories
 */
export function calculateACWR(
  activityRecords: ActivityRecord[]
): Array<{ day: string; acute: number; chronic: number; ratio: number }> {
  const sorted = [...activityRecords].sort((a, b) => a.day.localeCompare(b.day));
  const activeCalories = sorted.map((r) => r.active_calories);

  return sorted.map((record, i) => {
    const acute = getRollingAverage(activeCalories, i, 7);
    const chronic = getRollingAverage(activeCalories, i, 28);
    const ratio = chronic > 0 ? Number((acute / chronic).toFixed(2)) : 1.0;

    return {
      day: record.day,
      acute: Math.round(acute),
      chronic: Math.round(chronic),
      ratio,
    };
  });
}

/**
 * Detect Biometric Anomalies (F-4)
 * Deviations > 2 standard deviations from rolling 30-day baseline
 */
export function detectBiometricAnomalies(
  readinessRecords: ReadinessRecord[]
): Array<{ day: string; metric_id: string; value: number; z_score: number }> {
  const sorted = [...readinessRecords].sort((a, b) => a.day.localeCompare(b.day));
  const anomalies: Array<{ day: string; metric_id: string; value: number; z_score: number }> = [];

  const hrvValues = sorted.map((r) => r.hrv);
  const rhrValues = sorted.map((r) => r.rhr);
  const tempValues = sorted.map((r) => r.temperature_deviation);

  // Need at least 7 days of history for rolling baselines
  for (let i = 7; i < sorted.length; i++) {
    const day = sorted[i].day;

    // Rolling 30d window parameters
    const windowStart = Math.max(0, i - 30);
    const hrvWindow = hrvValues.slice(windowStart, i);
    const rhrWindow = rhrValues.slice(windowStart, i);
    const tempWindow = tempValues.slice(windowStart, i);

    // HRV Anomaly Check
    const hrvMean = mean(hrvWindow);
    const hrvStd = standardDeviation(hrvWindow);
    if (hrvStd > 0) {
      const hrvZ = (sorted[i].hrv - hrvMean) / hrvStd;
      if (Math.abs(hrvZ) > 2) {
        anomalies.push({ day, metric_id: "hrv", value: sorted[i].hrv, z_score: Number(hrvZ.toFixed(2)) });
      }
    }

    // RHR Anomaly Check
    const rhrMean = mean(rhrWindow);
    const rhrStd = standardDeviation(rhrWindow);
    if (rhrStd > 0) {
      const rhrZ = (sorted[i].rhr - rhrMean) / rhrStd;
      if (Math.abs(rhrZ) > 2) {
        anomalies.push({ day, metric_id: "rhr", value: sorted[i].rhr, z_score: Number(rhrZ.toFixed(2)) });
      }
    }

    // Temp Anomaly Check
    const tempMean = mean(tempWindow);
    const tempStd = standardDeviation(tempWindow);
    if (tempStd > 0) {
      const tempZ = (sorted[i].temperature_deviation - tempMean) / tempStd;
      if (Math.abs(tempZ) > 2) {
        anomalies.push({
          day,
          metric_id: "temperature_deviation",
          value: sorted[i].temperature_deviation,
          z_score: Number(tempZ.toFixed(2)),
        });
      }
    }
  }

  return anomalies.reverse(); // Newest first
}

/**
 * Helper to compute Pearson correlation between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const meanX = mean(x);
  const meanY = mean(y);

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  if (denX === 0 || denY === 0) return 0;
  return Number((num / Math.sqrt(denX * denY)).toFixed(2));
}

/**
 * Calculate Pearson Correlation Matrix between core health metrics (C9.3)
 */
export function calculatePearsonCorrelations(
  sleep: SleepRecord[],
  readiness: ReadinessRecord[],
  activity: ActivityRecord[]
): Record<string, Record<string, number>> {
  // Map records by day
  const sleepMap = new Map(sleep.map((s) => [s.day, s]));
  const readMap = new Map(readiness.map((r) => [r.day, r]));
  const actMap = new Map(activity.map((a) => [a.day, a]));

  // Find overlapping days
  const allDays = Array.from(new Set([...sleepMap.keys(), ...readMap.keys(), ...actMap.keys()])).sort();

  const metrics: Record<string, number[]> = {
    sleep_score: [],
    sleep_duration: [],
    readiness_score: [],
    hrv: [],
    rhr: [],
    activity_score: [],
    steps: [],
    active_calories: [],
  };

  for (const day of allDays) {
    const s = sleepMap.get(day);
    const r = readMap.get(day);
    const a = actMap.get(day);

    if (s && r && a) {
      metrics.sleep_score.push(s.score);
      metrics.sleep_duration.push(s.duration);
      metrics.readiness_score.push(r.score);
      metrics.hrv.push(r.hrv);
      metrics.rhr.push(r.rhr);
      metrics.activity_score.push(a.score);
      metrics.steps.push(a.steps);
      metrics.active_calories.push(a.active_calories);
    }
  }

  const keys = Object.keys(metrics);
  const matrix: Record<string, Record<string, number>> = {};

  for (const k1 of keys) {
    matrix[k1] = {};
    for (const k2 of keys) {
      matrix[k1][k2] = pearsonCorrelation(metrics[k1], metrics[k2]);
    }
  }

  return matrix;
}

/**
 * Calculate Tag Effects (C9.2)
 * Compare sleep/readiness scores with vs without tag presence (Cohen's d effect sizes)
 */
export function calculateTagEffects(
  rawTags: any[], // raw tag documents
  sleep: SleepRecord[],
  readiness: ReadinessRecord[]
): Array<{
  tag: string;
  metric: string;
  withCount: number;
  withoutCount: number;
  withAvg: number;
  withoutAvg: number;
  cohensD: number;
}> {
  // Parse tags by day
  const tagsByDay = new Map<string, Set<string>>();
  for (const tagDoc of rawTags) {
    const day = tagDoc.day ?? tagDoc.start_day;
    if (!day) continue;
    if (!tagsByDay.has(day)) {
      tagsByDay.set(day, new Set());
    }
    // Tag document tag array
    if (tagDoc.tags && Array.isArray(tagDoc.tags)) {
      tagDoc.tags.forEach((t: string) => tagsByDay.get(day)?.add(t));
    } else if (tagDoc.text) {
      tagsByDay.get(day)?.add(tagDoc.text);
    }
  }

  // Get unique tags list
  const allTags = Array.from(new Set(rawTags.flatMap((doc) => doc.tags ?? (doc.text ? [doc.text] : []))));
  if (allTags.length === 0) return [];

  const sleepMap = new Map(sleep.map((s) => [s.day, s.score]));
  const readMap = new Map(readiness.map((r) => [r.day, r.score]));

  const results: any[] = [];

  const metrics = [
    { name: "sleep_score", map: sleepMap },
    { name: "readiness_score", map: readMap },
  ];

  for (const tag of allTags) {
    for (const metric of metrics) {
      const withVals: number[] = [];
      const withoutVals: number[] = [];

      for (const [day, score] of metric.map.entries()) {
        const hasTag = tagsByDay.get(day)?.has(tag) ?? false;
        if (hasTag) {
          withVals.push(score);
        } else {
          withoutVals.push(score);
        }
      }

      // Need at least 2 samples with the tag to compute Cohen's d
      if (withVals.length >= 2 && withoutVals.length >= 2) {
        const meanWith = mean(withVals);
        const meanWithout = mean(withoutVals);

        const sdWith = standardDeviation(withVals);
        const sdWithout = standardDeviation(withoutVals);

        // Pooled Standard Deviation
        const pooledSd = Math.sqrt(
          ((withVals.length - 1) * sdWith * sdWith + (withoutVals.length - 1) * sdWithout * sdWithout) /
            (withVals.length + withoutVals.length - 2)
        );

        const cohensD = pooledSd > 0 ? Number(((meanWith - meanWithout) / pooledSd).toFixed(2)) : 0;

        results.push({
          tag,
          metric: metric.name,
          withCount: withVals.length,
          withoutCount: withoutVals.length,
          withAvg: Number(meanWith.toFixed(1)),
          withoutAvg: Number(meanWithout.toFixed(1)),
          cohensD,
        });
      }
    }
  }

  return results;
}
