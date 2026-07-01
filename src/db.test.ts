import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDb,
  closeDb,
  upsertSleep,
  upsertReadiness,
  upsertActivity,
  upsertStress,
  getHistory,
} from "./db.js";

describe("Database Manager", () => {
  beforeEach(async () => {
    // Force set test env just in case
    process.env.NODE_ENV = "test";
    // Initialize fresh in-memory database
    await getDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it("should initialize database tables successfully", async () => {
    const db = await getDb();
    const tables = await db.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("sleep_history");
    expect(tableNames).toContain("readiness_history");
    expect(tableNames).toContain("activity_history");
    expect(tableNames).toContain("stress_history");
  });

  it("should upsert sleep records correctly", async () => {
    const sleepRecord = {
      day: "2026-07-01",
      score: 85,
      duration: 28800,
      deep: 7200,
      rem: 5400,
      light: 16200,
      efficiency: 92,
    };

    await upsertSleep(sleepRecord);

    const history = await getHistory(1);
    expect(history.sleep.length).toBe(1);
    expect(history.sleep[0]).toEqual(sleepRecord);

    // Test updates on conflict
    const updatedRecord = { ...sleepRecord, score: 90 };
    await upsertSleep(updatedRecord);

    const updatedHistory = await getHistory(1);
    expect(updatedHistory.sleep.length).toBe(1);
    expect(updatedHistory.sleep[0].score).toBe(90);
  });

  it("should upsert readiness records correctly", async () => {
    const readinessRecord = {
      day: "2026-07-01",
      score: 80,
      hrv: 55,
      rhr: 60,
      temperature_deviation: 0.1,
    };

    await upsertReadiness(readinessRecord);

    const history = await getHistory(1);
    expect(history.readiness.length).toBe(1);
    expect(history.readiness[0]).toEqual(readinessRecord);
  });

  it("should upsert activity records correctly", async () => {
    const activityRecord = {
      day: "2026-07-01",
      score: 75,
      steps: 10000,
      active_calories: 400,
      total_calories: 2200,
    };

    await upsertActivity(activityRecord);

    const history = await getHistory(1);
    expect(history.activity.length).toBe(1);
    expect(history.activity[0]).toEqual(activityRecord);
  });

  it("should upsert stress records correctly", async () => {
    const stressRecord = {
      day: "2026-07-01",
      stress_duration: 3600,
      recovery_duration: 7200,
    };

    await upsertStress(stressRecord);

    const history = await getHistory(1);
    expect(history.stress.length).toBe(1);
    expect(history.stress[0]).toEqual(stressRecord);
  });

  it("should retrieve sorted history records", async () => {
    // Insert multiple records out of order
    await upsertSleep({
      day: "2026-07-03",
      score: 90,
      duration: 29000,
      deep: 7000,
      rem: 5000,
      light: 17000,
      efficiency: 95,
    });
    await upsertSleep({
      day: "2026-07-01",
      score: 80,
      duration: 27000,
      deep: 6000,
      rem: 4000,
      light: 17000,
      efficiency: 88,
    });
    await upsertSleep({
      day: "2026-07-02",
      score: 85,
      duration: 28000,
      deep: 6500,
      rem: 4500,
      light: 17000,
      efficiency: 90,
    });

    const history = await getHistory(5);
    expect(history.sleep.length).toBe(3);
    // Should be sorted ascending (for visual display charts)
    expect(history.sleep[0].day).toBe("2026-07-01");
    expect(history.sleep[1].day).toBe("2026-07-02");
    expect(history.sleep[2].day).toBe("2026-07-03");
  });
});
