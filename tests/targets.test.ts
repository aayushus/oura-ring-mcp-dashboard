import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculateSleepNeed,
  calculateRecommendedBedtime,
  calculateStepGoal,
  calculateMaxHr,
  calculateBmr,
  getSeedSleepNeed,
  parseClockTimeToMinutes,
  formatMinutesToClockTime,
} from "../src/utils/targets.js";
import type { UserProfile, UserTargets } from "../src/db.js";

describe("Targets Engine", () => {
  const mockProfile: UserProfile = {
    age: 30,
    weight_kg: 70,
    height_cm: 175,
    biological_sex: "male",
    target_wake_time: "07:00",
    goal: "sleep_better",
    training_days: 3,
  };

  it("should calculate correct seed sleep need based on age", () => {
    expect(getSeedSleepNeed(20)).toBe(8.0 * 3600);
    expect(getSeedSleepNeed(30)).toBe(7.75 * 3600);
    expect(getSeedSleepNeed(70)).toBe(7.25 * 3600);
  });

  it("should parse and format clock times correctly", () => {
    expect(parseClockTimeToMinutes("07:00")).toBe(420);
    expect(parseClockTimeToMinutes("23:30")).toBe(1410);
    expect(formatMinutesToClockTime(420)).toBe("07:00");
    expect(formatMinutesToClockTime(1410)).toBe("23:30");
    expect(formatMinutesToClockTime(-30)).toBe("23:30"); // crosses midnight backwards
  });

  it("should fall back to seed sleep need if insufficient good history", () => {
    const prevTargets: UserTargets = {
      sleep_need_seconds: 7.75 * 3600,
      recommended_bedtime: "23:00",
      step_goal: 8000,
      max_hr: 180,
      bmr_kcal: 1600,
    };

    const res = calculateSleepNeed(mockProfile, prevTargets, [], []);
    expect(res.sleepNeed).toBe(7.75 * 3600);
    expect(res.reason).toContain("insufficient history");
  });

  it("should calculate sleep need from goodDays (readiness >= 80)", () => {
    // Generate 15 well-recovered days
    const readinessScores = Array.from({ length: 15 }, (_, i) => ({
      day: `2024-01-${(i + 1).toString().padStart(2, "0")}`,
      score: 85,
    }));

    const sleepSessions = Array.from({ length: 15 }, (_, i) => ({
      day: `2024-01-${(i + 1).toString().padStart(2, "0")}`,
      total_sleep_duration: 8.5 * 3600, // 8.5 hours
      bedtime_end: "2024-01-02T08:00:00Z", // wake-up time 08:00, wake_time is 07:00, diff > 15m (not truncated)
    }));

    const res = calculateSleepNeed(mockProfile, null, readinessScores, sleepSessions);
    // seed is 7.75h (27900). estimate is 8.5h (30600).
    // blend: 0.7 * 30600 + 0.3 * 27900 = 21420 + 8370 = 29790 (8.275h)
    expect(res.sleepNeed).toBe(29790);
    expect(res.reason).toContain("readiness ≥ 80");
  });

  it("should calculate step goal stretching 10% over median", () => {
    const activities = Array.from({ length: 20 }, () => ({
      steps: 10000,
      non_wear_time: 0,
    }));

    const res = calculateStepGoal(mockProfile, null, activities);
    // median: 10000. stretch +10%: 11000. round to 500: 11000.
    expect(res.stepGoal).toBe(11000);
  });

  it("should apply Tanaka formula for max HR and override if observed higher", () => {
    const hr = calculateMaxHr(mockProfile, [{ bpm: 150 }, { bpm: 190 }]);
    // Tanaka = 208 - 0.7 * 30 = 208 - 21 = 187.
    // Observed max = 190.
    expect(hr).toBe(190);
  });

  it("should calculate Mifflin-St Jeor BMR correctly", () => {
    // Male: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    expect(calculateBmr(mockProfile)).toBe(1648.75);
  });
});
