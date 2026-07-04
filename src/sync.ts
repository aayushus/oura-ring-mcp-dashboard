/**
 * Data Sync Coordinator for Oura Ring API -> SQLite
 *
 * Every run is tracked per-endpoint (live, for the sync drawer) and
 * persisted to sync_log. One failing endpoint no longer aborts the run —
 * it becomes a "partial" sync with the failure named.
 */

import cron from "node-cron";
import { OuraClient } from "./client.js";
import {
  upsertSleep,
  upsertReadiness,
  upsertActivity,
  upsertStress,
  upsertRawDocument,
  upsertUserProfile,
  getUserProfile,
  getKnownDays,
  insertSyncLog,
  finalizeSyncLog,
  type SyncEndpointResult,
} from "./db.js";
import { getToday, getDaysAgo } from "./utils/index.js";
import { getAllOuraConnections, upsertOuraConnection, updateOuraSyncStatus } from "./auth/db.js";
import { getOuraCredentials } from "./auth/settings.js";

export type SyncTrigger = "manual" | "scheduled" | "startup" | "auto";

export interface SyncJob {
  id: number;
  trigger: SyncTrigger;
  startDate: string;
  endDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "partial" | "error";
  syncedDays: number;
  newDays: number;
  totalRecords: number;
  endpoints: SyncEndpointResult[];
  error?: string;
}

export interface SyncResult {
  success: boolean;
  status: "success" | "partial" | "error";
  syncedDays: number;
  newDays: number;
  totalRecords: number;
  endpoints: SyncEndpointResult[];
  error?: string;
}

/** Endpoint descriptors — key/label/group drive the sync drawer UI. */
const SYNC_ENDPOINTS: Array<{
  key: string;
  label: string;
  group: string;
  optional?: boolean;
  fetch: (client: OuraClient, start: string, end: string) => Promise<any>;
}> = [
  { key: "daily_sleep", label: "Sleep scores", group: "Sleep", fetch: (c, s, e) => c.getDailySleep(s, e) },
  { key: "sleep", label: "Sleep sessions", group: "Sleep", fetch: (c, s, e) => c.getSleep(s, e) },
  { key: "sleep_time", label: "Bedtime windows", group: "Sleep", fetch: (c, s, e) => c.getSleepTime(s, e) },
  { key: "daily_readiness", label: "Readiness", group: "Readiness", fetch: (c, s, e) => c.getDailyReadiness(s, e) },
  { key: "daily_activity", label: "Activity", group: "Activity", fetch: (c, s, e) => c.getDailyActivity(s, e) },
  { key: "daily_stress", label: "Stress", group: "Stress", fetch: (c, s, e) => c.getDailyStress(s, e) },
  { key: "heartrate", label: "Heart rate samples", group: "Heart rate", fetch: (c, s, e) => c.getHeartRate(s, e) },
  { key: "workout", label: "Workouts", group: "Workouts & sessions", fetch: (c, s, e) => c.getWorkouts(s, e) },
  { key: "session", label: "Sessions", group: "Workouts & sessions", fetch: (c, s, e) => c.getSessions(s, e) },
  { key: "daily_spo2", label: "Blood oxygen", group: "Vitals", fetch: (c, s, e) => c.getDailySpo2(s, e) },
  { key: "vO2_max", label: "VO2 max", group: "Vitals", fetch: (c, s, e) => c.getVO2Max(s, e) },
  { key: "daily_resilience", label: "Resilience", group: "Vitals", fetch: (c, s, e) => c.getDailyResilience(s, e) },
  { key: "daily_cardiovascular_age", label: "Cardio age", group: "Vitals", fetch: (c, s, e) => c.getDailyCardiovascularAge(s, e) },
  { key: "enhanced_tag", label: "Tags", group: "Tags & device", fetch: (c, s, e) => c.getEnhancedTags(s, e) },
  { key: "ring_configuration", label: "Ring info", group: "Tags & device", optional: true, fetch: (c) => c.getRingConfiguration() },
  { key: "rest_mode_period", label: "Rest modes", group: "Tags & device", optional: true, fetch: (c, s, e) => c.getRestModePeriods(s, e) },
  { key: "personal_info", label: "Profile", group: "Tags & device", optional: true, fetch: (c) => c.getPersonalInfo() },
];

/** In-memory view of the current (or most recent) run, for GET /sync/status. */
let activeJob: SyncJob | null = null;

export function getActiveSyncJob(): SyncJob | null {
  return activeJob;
}

export function isSyncRunning(): boolean {
  return activeJob?.status === "running";
}

/**
 * Fetch data for a date range from Oura API and store in the database.
 */
export async function syncData(
  client: OuraClient,
  startDate: string,
  endDate: string,
  trigger: SyncTrigger = "manual",
  userId: number = 1
): Promise<SyncResult> {
  if (isSyncRunning()) {
    return {
      success: false,
      status: "error",
      syncedDays: 0,
      newDays: 0,
      totalRecords: 0,
      endpoints: [],
      error: "A sync is already running",
    };
  }

  const startedAt = new Date().toISOString();
  let logId = 0;
  let knownDays = new Set<string>();
  try {
    knownDays = await getKnownDays(userId);
    logId = await insertSyncLog({
      started_at: startedAt,
      trigger_source: trigger,
      start_date: startDate,
      end_date: endDate,
    }, userId);
  } catch (error) {
    console.error("[Sync] Failed to open sync log:", error);
  }

  const job: SyncJob = {
    id: logId,
    trigger,
    startDate,
    endDate,
    startedAt,
    finishedAt: null,
    status: "running",
    syncedDays: 0,
    newDays: 0,
    totalRecords: 0,
    endpoints: SYNC_ENDPOINTS.map((e) => ({
      key: e.key,
      label: e.label,
      group: e.group,
      status: "running",
      records: 0,
    })),
  };
  activeJob = job;

  console.log(`[Sync] Syncing Oura data from ${startDate} to ${endDate} (${trigger})...`);

  try {
    // Fetch all endpoints concurrently; each settles independently and
    // updates the live job state as it lands.
    const results: Record<string, any> = {};
    await Promise.all(
      SYNC_ENDPOINTS.map(async (endpoint, index) => {
        const state = job.endpoints[index];
        try {
          const response = await endpoint.fetch(client, startDate, endDate);
          const records =
            response == null ? 0 : Array.isArray(response.data) ? response.data.length : 1;
          results[endpoint.key] = response;
          state.status = "done";
          state.records = records;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results[endpoint.key] = null;
          if (endpoint.optional) {
            // Tolerated endpoints (device info, profile) never fail a run
            state.status = "done";
            state.records = 0;
          } else {
            state.status = "error";
            state.error = message;
            console.error(`[Sync] ${endpoint.label} failed: ${message}`);
          }
        }
      })
    );

    const days = new Set<string>();

    // Store raw payloads for read-time logic
    const saveRawDocs = async (endpoint: string, dataArray: any[] | undefined) => {
      if (!dataArray) return;
      for (const doc of dataArray) {
        const day = doc.day ?? doc.start_day ?? doc.timestamp?.split("T")[0] ?? doc.start_datetime?.split("T")[0] ?? getToday();
        const docId = doc.id ?? doc.timestamp ?? doc.start_datetime ?? `gen-${Math.random()}`;
        await upsertRawDocument(day, endpoint, docId, doc, userId);
      }
    };

    for (const endpoint of SYNC_ENDPOINTS) {
      if (endpoint.key === "personal_info") continue;
      await saveRawDocs(endpoint.key, results[endpoint.key]?.data);
    }

    const personalInfo = results["personal_info"];
    if (personalInfo) {
      const existing = await getUserProfile(userId);
      await upsertUserProfile({
        age: personalInfo.age ?? existing?.age ?? 30,
        weight_kg: personalInfo.weight ?? existing?.weight_kg ?? 70,
        height_cm: personalInfo.height ?? existing?.height_cm ?? 175,
        biological_sex: personalInfo.biological_sex ?? existing?.biological_sex ?? "unknown",
        target_wake_time: existing?.target_wake_time ?? "07:00:00",
        goal: existing?.goal ?? "general_health",
        training_days: existing?.training_days ?? 3,
      }, userId);
    }

    // 1. Process Sleep
    const sleepScores = results["daily_sleep"]?.data ?? [];
    const sleepSessions = results["sleep"]?.data ?? [];
    const sessionsByDay = new Map<string, any>(sleepSessions.map((s: any) => [s.day, s]));
    for (const score of sleepScores) {
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
      }, userId);
    }

    // 2. Process Readiness
    for (const read of results["daily_readiness"]?.data ?? []) {
      days.add(read.day);
      const session = sessionsByDay.get(read.day);
      await upsertReadiness({
        day: read.day,
        score: read.score ?? 0,
        hrv: session?.average_hrv ?? 0,
        rhr: session?.lowest_heart_rate ?? 0,
        temperature_deviation: read.temperature_deviation ?? 0,
      }, userId);
    }

    // 3. Process Activity
    for (const act of results["daily_activity"]?.data ?? []) {
      days.add(act.day);
      await upsertActivity({
        day: act.day,
        score: act.score ?? 0,
        steps: act.steps ?? 0,
        active_calories: act.active_calories ?? 0,
        total_calories: act.total_calories ?? 0,
      }, userId);
    }

    // 4. Process Stress
    for (const str of results["daily_stress"]?.data ?? []) {
      days.add(str.day);
      await upsertStress({
        day: str.day,
        stress_duration: str.stress_high ?? 0,
        recovery_duration: str.recovery_high ?? 0,
      }, userId);
    }

    const failed = job.endpoints.filter((e) => e.status === "error");
    const status: SyncJob["status"] =
      failed.length === 0 ? "success" : failed.length < job.endpoints.length ? "partial" : "error";

    job.status = status;
    job.finishedAt = new Date().toISOString();
    job.syncedDays = days.size;
    job.newDays = [...days].filter((d) => !knownDays.has(d)).length;
    job.totalRecords = job.endpoints.reduce((sum, e) => sum + e.records, 0);
    if (failed.length > 0) {
      job.error = failed.map((e) => `${e.label}: ${e.error}`).join("; ");
    }

    if (logId) {
      await finalizeSyncLog(logId, {
        status,
        synced_days: job.syncedDays,
        new_days: job.newDays,
        total_records: job.totalRecords,
        endpoints: job.endpoints,
        error: job.error ?? null,
      });
    }

    console.log(
      `[Sync] Completed (${status}). ${job.syncedDays} days (${job.newDays} new), ${job.totalRecords} records.`
    );
    return {
      success: status !== "error",
      status,
      syncedDays: job.syncedDays,
      newDays: job.newDays,
      totalRecords: job.totalRecords,
      endpoints: job.endpoints,
      error: job.error,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Sync] Failed to sync data:`, errorMsg);
    job.status = "error";
    job.finishedAt = new Date().toISOString();
    job.error = errorMsg;
    if (logId) {
      await finalizeSyncLog(logId, {
        status: "error",
        synced_days: 0,
        new_days: 0,
        total_records: 0,
        endpoints: job.endpoints,
        error: errorMsg,
      }).catch(() => {});
    }
    return {
      success: false,
      status: "error",
      syncedDays: 0,
      newDays: 0,
      totalRecords: 0,
      endpoints: job.endpoints,
      error: errorMsg,
    };
  }
}

/**
 * Run a synchronization run for a specific user connection.
 * Handles token refreshing dynamically.
 */
export async function syncUserConnection(
  conn: any,
  startDate: string,
  endDate: string,
  trigger: SyncTrigger
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(conn.expires_at);

    let accessToken = conn.access_token;
    let refreshToken = conn.refresh_token;
    let expiresStr = conn.expires_at;

    // Refresh token if expired or close to expiry (e.g. within 5 minutes)
    if (now.getTime() + 5 * 60 * 1000 >= expiresAt.getTime()) {
      console.log(`[Sync] Refreshing Oura OAuth token for user ${conn.user_id}...`);
      const creds = await getOuraCredentials();
      if (!creds.clientId || !creds.clientSecret) {
        throw new Error("Oura application client credentials are not configured.");
      }

      const response = await fetch("https://api.ouraring.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }),
      });

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || data.error || "Token refresh failed");
      }

      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      expiresStr = new Date(Date.now() + data.expires_in * 1000).toISOString();

      await upsertOuraConnection(conn.user_id, {
        accessToken,
        refreshToken,
        expiresAt: expiresStr,
        scopes: data.scope || conn.scopes,
      });
      console.log(`[Sync] Token refreshed successfully for user ${conn.user_id}.`);
    }

    const client = new OuraClient({ accessToken });
    const result = await syncData(client, startDate, endDate, trigger, conn.user_id);
    
    if (result.success) {
      await updateOuraSyncStatus(conn.user_id, null);
    } else {
      await updateOuraSyncStatus(conn.user_id, result.error || "Sync failed");
    }
  } catch (err: any) {
    const message = err.message || String(err);
    console.error(`[Sync] Sync failed for user ${conn.user_id}:`, message);
    await updateOuraSyncStatus(conn.user_id, message);
  }
}

/**
 * Initialize background cron scheduler to sync data automatically for all users
 */
export function startSyncScheduler(legacyClient?: OuraClient): cron.ScheduledTask {
  console.log("[Sync] Initializing background sync scheduler (4-hour intervals)...");

  // Perform initial backfill of past 365 days for all connected users
  if (process.env.NODE_ENV !== "test") {
    // Start backfill asynchronously
    (async () => {
      try {
        const connections = await getAllOuraConnections();
        console.log(`[Sync] Found ${connections.length} Oura connection(s) for startup backfill.`);
        for (const conn of connections) {
          const backfillStart = getDaysAgo(365);
          const today = getToday();
          await syncUserConnection(conn, backfillStart, today, "startup");
        }
      } catch (err) {
        console.error("[Sync] Startup backfill failed:", err);
      }
    })();
  }

  // Schedule cron job: every 4 hours (at minute 0)
  // Pattern: 0 */4 * * *
  const task = cron.schedule("0 */4 * * *", async () => {
    try {
      const connections = await getAllOuraConnections();
      console.log(`[Sync] Running scheduled sync for ${connections.length} users...`);
      const start = getDaysAgo(2); // pull last 2 days to capture revisions/late syncs
      const end = getToday();

      for (const conn of connections) {
        await syncUserConnection(conn, start, end, "scheduled");
      }
    } catch (err) {
      console.error("[Sync] Scheduled sync loop failed:", err);
    }
  });

  return task;
}
