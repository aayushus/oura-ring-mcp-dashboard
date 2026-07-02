import { describe, it, expect } from "vitest";
import {
  calculateSleepDebt,
  calculateACWR,
  detectBiometricAnomalies,
  calculatePearsonCorrelations,
} from "../src/utils/analysis/dashboard.js";
import type { SleepRecord, ReadinessRecord, ActivityRecord } from "../src/db.js";

describe("Dashboard Advanced Analysis Equations", () => {
  it("should calculate correct sleep debt trend chronologically", () => {
    const sleepRecords: SleepRecord[] = [
      { day: "2024-01-02", score: 80, duration: 7 * 3600, deep: 3600, rem: 3600, light: 10000, efficiency: 90 },
      { day: "2024-01-01", score: 75, duration: 6 * 3600, deep: 3000, rem: 3000, light: 9000, efficiency: 85 },
    ];
    // Need: 8 hours (28800s).
    // Day 1: got 6h (21600s), debt = +2h
    // Day 2: got 7h (25200s), debt = +2h + 1h = +3h
    const debt = calculateSleepDebt(sleepRecords, 8 * 3600);
    expect(debt.length).toBe(2);
    expect(debt[0].day).toBe("2024-01-01");
    expect(debt[0].debt).toBe(2.0);
    expect(debt[1].day).toBe("2024-01-02");
    expect(debt[1].debt).toBe(3.0);
  });

  it("should calculate rolling Acute:Chronic Workload Ratio (ACWR) accurately", () => {
    // Generate 30 days of active calories
    const activityRecords: ActivityRecord[] = Array.from({ length: 35 }, (_, i) => ({
      day: `2024-01-${(i + 1).toString().padStart(2, "0")}`,
      score: 80,
      steps: 10000,
      active_calories: i < 28 ? 500 : 1000, // Spike in the last 7 days
      total_calories: 2500,
    }));

    const acwr = calculateACWR(activityRecords);
    expect(acwr.length).toBe(35);
    const lastDay = acwr[34];
    // Acute (last 7 days: days 29-35): all are 1000, avg = 1000
    // Chronic (last 28 days: days 8-35): 21 days of 500, 7 days of 1000 -> avg = (21*500 + 7*1000)/28 = (10500 + 7000)/28 = 17500/28 = 625
    // Ratio = 1000 / 625 = 1.6
    expect(lastDay.acute).toBe(1000);
    expect(lastDay.chronic).toBe(625);
    expect(lastDay.ratio).toBe(1.6);
  });

  it("should flag biometric anomalies exceeding 2 standard deviations", () => {
    // 20 normal readiness records + 1 anomalous day
    const records: ReadinessRecord[] = Array.from({ length: 21 }, (_, i) => ({
      day: `2024-01-${(i + 1).toString().padStart(2, "0")}`,
      score: 80,
      hrv: i === 20 ? 5 : (50 + (i % 2) * 5), // Massive drop vs baseline alternating 50/55
      rhr: 60,
      temperature_deviation: 0.0,
    }));

    const anomalies = detectBiometricAnomalies(records);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].metric_id).toBe("hrv");
    expect(anomalies[0].day).toBe("2024-01-21");
    expect(anomalies[0].z_score).toBeLessThan(0); // Negative Z-score for decrease
  });

  it("should construct Pearson correlation matrix for core parameters", () => {
    const sleep: SleepRecord[] = [
      { day: "2024-01-01", score: 80, duration: 28800, deep: 3600, rem: 3600, light: 10000, efficiency: 90 },
      { day: "2024-01-02", score: 60, duration: 21600, deep: 2000, rem: 2000, light: 8000, efficiency: 80 },
    ];
    const readiness: ReadinessRecord[] = [
      { day: "2024-01-01", score: 85, hrv: 60, rhr: 55, temperature_deviation: 0 },
      { day: "2024-01-02", score: 65, hrv: 40, rhr: 65, temperature_deviation: 0.5 },
    ];
    const activity: ActivityRecord[] = [
      { day: "2024-01-01", score: 80, steps: 10000, active_calories: 500, total_calories: 2500 },
      { day: "2024-01-02", score: 70, steps: 8000, active_calories: 400, total_calories: 2300 },
    ];

    const matrix = calculatePearsonCorrelations(sleep, readiness, activity);
    // Correlation of metric with itself must be 1.0
    expect(matrix.sleep_score.sleep_score).toBe(1.0);
    // sleep_score and readiness_score both went down, positive correlation
    expect(matrix.sleep_score.readiness_score).toBeGreaterThan(0);
  });
});
