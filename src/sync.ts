/**
 * Data Sync Coordinator for Oura Ring API -> SQLite
 */

import cron from "node-cron";
import type { OuraClient } from "./client.js";
import {
  upsertSleep,
  upsertReadiness,
  upsertActivity,
  upsertStress,
  upsertStressBulk,
  upsertRawDocument,
  getHistory,
  upsertUserProfile,
  getUserProfile,
} from "./db.js";
import { getToday, getDaysAgo } from "./utils/index.js";

/**
 * Fetch data for a date range from Oura API and store in SQLite
 */
export async function syncData(
  client: OuraClient,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; syncedDays: number; error?: string }> {
  try {
    console.log(`[Sync] Syncing Oura data from ${startDate} to ${endDate}...`);

    // Fetch endpoints in parallel
    // Fetch endpoints in parallel
    const [
      sleepScores,
      sleepSessions,
      readiness,
      activity,
      stress,
      heartRate,
      workouts,
      sessions,
      sleepTime,
      dailySpo2,
      vo2Max,
      dailyResilience,
      dailyCardiovascularAge,
      enhancedTags,
      ringConfigs,
      restModes,
      personalInfo,
    ] = await Promise.all([
      client.getDailySleep(startDate, endDate),
      client.getSleep(startDate, endDate),
      client.getDailyReadiness(startDate, endDate),
      client.getDailyActivity(startDate, endDate),
      client.getDailyStress(startDate, endDate),
      client.getHeartRate(startDate, endDate),
      client.getWorkouts(startDate, endDate),
      client.getSessions(startDate, endDate),
      client.getSleepTime(startDate, endDate),
      client.getDailySpo2(startDate, endDate),
      client.getVO2Max(startDate, endDate),
      client.getDailyResilience(startDate, endDate),
      client.getDailyCardiovascularAge(startDate, endDate),
      client.getEnhancedTags(startDate, endDate),
      client.getRingConfiguration().catch(() => ({ data: [] })),
      client.getRestModePeriods(startDate, endDate).catch(() => ({ data: [] })),
      client.getPersonalInfo().catch(() => null),
    ]);

    const days = new Set<string>();

    // Helper to store raw docs
    const saveRawDocs = async (endpoint: string, dataArray: any[]) => {
      if (!dataArray) return;
      for (const doc of dataArray) {
        const day = doc.day ?? doc.start_day ?? doc.timestamp?.split("T")[0] ?? doc.start_datetime?.split("T")[0] ?? getToday();
        const docId = doc.id ?? doc.timestamp ?? doc.start_datetime ?? `gen-${Math.random()}`;
        await upsertRawDocument(day, endpoint, docId, doc);
      }
    };

    // Store raw payloads for read-time logic
    await Promise.all([
      saveRawDocs("daily_sleep", sleepScores.data),
      saveRawDocs("sleep", sleepSessions.data),
      saveRawDocs("daily_readiness", readiness.data),
      saveRawDocs("daily_activity", activity.data),
      saveRawDocs("daily_stress", stress.data),
      saveRawDocs("heartrate", heartRate.data),
      saveRawDocs("workout", workouts.data),
      saveRawDocs("session", sessions.data),
      saveRawDocs("sleep_time", sleepTime.data),
      saveRawDocs("daily_spo2", dailySpo2.data),
      saveRawDocs("vO2_max", vo2Max.data),
      saveRawDocs("daily_resilience", dailyResilience.data),
      saveRawDocs("daily_cardiovascular_age", dailyCardiovascularAge.data),
      saveRawDocs("enhanced_tag", enhancedTags.data),
      saveRawDocs("ring_configuration", ringConfigs.data),
      saveRawDocs("rest_mode_period", restModes.data),
    ]);

    if (personalInfo) {
      const existing = await getUserProfile();
      await upsertUserProfile({
        age: personalInfo.age ?? existing?.age ?? 30,
        weight_kg: personalInfo.weight ?? existing?.weight_kg ?? 70,
        height_cm: personalInfo.height ?? existing?.height_cm ?? 175,
        biological_sex: personalInfo.biological_sex ?? existing?.biological_sex ?? "unknown",
        target_wake_time: existing?.target_wake_time ?? "07:00:00",
        goal: existing?.goal ?? "general_health",
        training_days: existing?.training_days ?? 3,
      });
    }

    // 1. Process Sleep
    const sessionsByDay = new Map<string, any>(sleepSessions.data.map((s: any) => [s.day, s]));
    for (const score of sleepScores.data) {
      days.add(score.day);
      const session = sessionsByDay.get(score.day);

      await upsertSleep({
        day: score.day,
        score: score.score ?? 0,
        duration: session?.total_sleep_duration ?? 0,
        deep: session?.deep_sleep_duration ?? 0,
        rem: session?.rem_sleep_duration ?? 0,
        light: session?.light_sleep_duration ?? 0,
        efficiency: session?.efficiency ?? score.contributors?.efficiency ?? 0,
      });
    }

    // 2. Process Readiness
    for (const read of readiness.data) {
      days.add(read.day);
      const session = sessionsByDay.get(read.day);

      await upsertReadiness({
        day: read.day,
        score: read.score ?? 0,
        hrv: session?.average_hrv ?? 0,
        rhr: session?.lowest_heart_rate ?? 0,
        temperature_deviation: read.temperature_deviation ?? 0,
      });
    }

    // 3. Process Activity
    for (const act of activity.data) {
      days.add(act.day);
      await upsertActivity({
        day: act.day,
        score: act.score ?? 0,
        steps: act.steps ?? 0,
        active_calories: act.active_calories ?? 0,
        total_calories: act.total_calories ?? 0,
      });
    }

    // 4. Process Stress
    const stressRecords = stress.data.map((str: any) => {
      days.add(str.day);
      return {
        day: str.day,
        stress_duration: str.stress_high ?? 0,
        recovery_duration: str.recovery_high ?? 0,
      };
    });

    if (stressRecords.length > 0) {
      await upsertStressBulk(stressRecords);
    }

    console.log(`[Sync] Completed sync successfully. Synced ${days.size} days.`);
    return { success: true, syncedDays: days.size };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Sync] Failed to sync data:`, errorMsg);
    return { success: false, syncedDays: 0, error: errorMsg };
  }
}

/**
 * Initialize background cron scheduler to sync data automatically
 */
export function startSyncScheduler(client: OuraClient): cron.ScheduledTask {
  console.log("[Sync] Initializing background sync scheduler (4-hour intervals)...");

  // Perform initial backfill of past 365 days
  const backfillStart = getDaysAgo(365);
  const today = getToday();
  
  if (process.env.NODE_ENV !== "test") {
    // Start backfill asynchronously
    syncData(client, backfillStart, today).catch((err) => {
      console.error("[Sync] Initial backfill failed:", err);
    });
  }

  // Schedule cron job: every 4 hours (at minute 0)
  // Pattern: 0 */4 * * *
  const task = cron.schedule("0 */4 * * *", async () => {
    const start = getDaysAgo(2); // pull last 2 days to capture revisions/late syncs
    const end = getToday();
    await syncData(client, start, end);
  });

  return task;
}
