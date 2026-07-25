/**
 * Dual Database Manager (PostgreSQL / SQLite) for Oura Ring health history
 */

import { open } from "sqlite";
import sqlite3 from "sqlite3";
import pg from "pg";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { getContextUserId } from "./auth/context.js";

const CONFIG_DIR = join(homedir(), ".oura-mcp");
const DB_FILE = process.env.NODE_ENV === "test" ? ":memory:" : join(CONFIG_DIR, "oura-health.db");

export interface DatabaseWrapper {
  exec(sql: string): Promise<void>;
  all<T = any>(sql: string, params?: any[]): Promise<T>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ changes?: number; lastID?: number }>;
  close(): Promise<void>;
}

export function resolveUserId(userId: number): number {
  if (userId !== 1) return userId;
  return getContextUserId() ?? 1;
}

let dbInstance: DatabaseWrapper | null = null;
export let isPostgres = false;

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

function translateQuery(sql: string): string {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Initialize and open the database, creating tables if they do not exist
 */
export async function getDb(): Promise<DatabaseWrapper> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log("[DB] Connecting to PostgreSQL database...");
    const pool = new pg.Pool({ connectionString: dbUrl });

    // Test connection
    const client = await pool.connect();
    client.release();

    isPostgres = true;
    dbInstance = {
      async exec(sql: string) {
        let pgSql = sql
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY")
          .replace(/CHECK\s*\(\s*id\s*=\s*1\s*\)/gi, "") // Postgres check constraint difference fallback
          .replace(/PRIMARY KEY\s*\(\s*day\s*,\s*endpoint\s*,\s*doc_id\s*\)/gi, "PRIMARY KEY (day, endpoint, doc_id)")
          .replace(/datetime\('now'\)/gi, "NOW()")
          .replace(/\bTEXT\s+NOT\s+NULL\s+DEFAULT\s+\(NOW\(\)\)/gi, "TEXT NOT NULL DEFAULT (NOW()::text)")
          .replace(/DEFAULT\s+\(NOW\(\)\)/gi, "DEFAULT NOW()");

        // Split multi-statement SQL and execute each statement individually
        // to avoid partial failure silently swallowing errors.
        const statements = pgSql
          .split(/;\s*$/m)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          await pool.query(stmt);
        }
      },
      async all<T = any>(sql: string, params: any[] = []) {
        const pgSql = translateQuery(sql);
        const res = await pool.query(pgSql, params);
        return res.rows as unknown as T;
      },
      async get<T = any>(sql: string, params: any[] = []) {
        const pgSql = translateQuery(sql);
        const res = await pool.query(pgSql, params);
        return (res.rows[0] ?? undefined) as unknown as T | undefined;
      },
      async run(sql: string, params: any[] = []) {
        const pgSql = translateQuery(sql);
        const res = await pool.query(pgSql, params);
        return { changes: res.rowCount ?? undefined, lastID: 0 };
      },
      async close() {
        await pool.end();
      }
    };
  } else {
    console.log("[DB] Connecting to SQLite database...");
    await ensureConfigDir();
    const sqliteDb = await open({
      filename: DB_FILE,
      driver: sqlite3.Database,
    });
    isPostgres = false;
    dbInstance = {
      async exec(sql: string) {
        await sqliteDb.exec(sql);
      },
      async all<T = any>(sql: string, params: any[] = []) {
        return sqliteDb.all(sql, params) as Promise<T>;
      },
      async get<T = any>(sql: string, params: any[] = []) {
        return sqliteDb.get(sql, params) as Promise<T | undefined>;
      },
      async run(sql: string, params: any[] = []) {
        return sqliteDb.run(sql, params);
      },
      async close() {
        await sqliteDb.close();
      }
    };
  }

  // Create tables with user_id scoping
  await dbInstance!.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      last_seen TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER
    );

    CREATE TABLE IF NOT EXISTS oura_connections (
      user_id INTEGER PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      scopes TEXT,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_sync_at TEXT,
      sync_error TEXT
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT NOT NULL,
      attempted TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sleep_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      duration INTEGER,
      deep INTEGER,
      rem INTEGER,
      light INTEGER,
      efficiency INTEGER,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS readiness_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      hrv INTEGER,
      rhr INTEGER,
      temperature_deviation REAL,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS activity_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      steps INTEGER,
      active_calories INTEGER,
      total_calories INTEGER,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS stress_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      stress_duration INTEGER,
      recovery_duration INTEGER,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      user_id INTEGER PRIMARY KEY,
      age INTEGER,
      weight_kg REAL,
      height_cm REAL,
      biological_sex TEXT,
      target_wake_time TEXT,
      goal TEXT,
      training_days INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_targets (
      user_id INTEGER PRIMARY KEY,
      sleep_need_seconds INTEGER,
      recommended_bedtime TEXT,
      step_goal INTEGER,
      max_hr INTEGER,
      bmr_kcal REAL
    );

    CREATE TABLE IF NOT EXISTS target_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_id TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      change_date TEXT
    );

    CREATE TABLE IF NOT EXISTS raw_documents (
      user_id INTEGER NOT NULL,
      day TEXT,
      endpoint TEXT,
      doc_id TEXT,
      data TEXT,
      PRIMARY KEY (user_id, day, endpoint, doc_id)
    );

    CREATE TABLE IF NOT EXISTS experiments (
      user_id INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      title TEXT,
      behavior_text TEXT,
      metric_ids TEXT,
      direction_hypothesis TEXT,
      start_date TEXT,
      duration_days INTEGER,
      status TEXT,
      confounder_warning TEXT
    );

    CREATE TABLE IF NOT EXISTS experiment_days (
      user_id INTEGER NOT NULL,
      experiment_id TEXT,
      day TEXT,
      adherent INTEGER,
      PRIMARY KEY (user_id, experiment_id, day)
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      user_id INTEGER NOT NULL,
      day TEXT,
      metric_id TEXT,
      value REAL,
      z_score REAL,
      PRIMARY KEY (user_id, day, metric_id)
    );

    CREATE TABLE IF NOT EXISTS digest_log (
      user_id INTEGER NOT NULL,
      date TEXT,
      channel TEXT,
      sent_at TEXT,
      had_data INTEGER,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS alert_prefs (
      user_id INTEGER NOT NULL,
      alert_type TEXT,
      muted INTEGER DEFAULT 0,
      muted_at TEXT,
      PRIMARY KEY (user_id, alert_type)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      trigger_source TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      synced_days INTEGER DEFAULT 0,
      new_days INTEGER DEFAULT 0,
      total_records INTEGER DEFAULT 0,
      endpoints TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS mcp_api_keys (
      key_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `);

  await runDbMigration(dbInstance!);

  return dbInstance!;
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Sleep Operations
// ─────────────────────────────────────────────────────────────

export interface SleepRecord {
  day: string;
  score: number;
  duration: number;
  deep: number;
  rem: number;
  light: number;
  efficiency: number;
}

export async function upsertSleep(record: SleepRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO sleep_history (user_id, day, score, duration, deep, rem, light, efficiency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       score = excluded.score,
       duration = excluded.duration,
       deep = excluded.deep,
       rem = excluded.rem,
       light = excluded.light,
       efficiency = excluded.efficiency`,
    [
      userId,
      record.day,
      record.score,
      record.duration,
      record.deep,
      record.rem,
      record.light,
      record.efficiency,
    ]
  );
}

// ─────────────────────────────────────────────────────────────
// Readiness Operations
// ─────────────────────────────────────────────────────────────

export interface ReadinessRecord {
  day: string;
  score: number;
  hrv: number;
  rhr: number;
  temperature_deviation: number;
}

export async function upsertReadiness(record: ReadinessRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO readiness_history (user_id, day, score, hrv, rhr, temperature_deviation)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       score = excluded.score,
       hrv = excluded.hrv,
       rhr = excluded.rhr,
       temperature_deviation = excluded.temperature_deviation`,
    [
      userId,
      record.day,
      record.score,
      record.hrv,
      record.rhr,
      record.temperature_deviation,
    ]
  );
}

// ─────────────────────────────────────────────────────────────
// Activity Operations
// ─────────────────────────────────────────────────────────────

export interface ActivityRecord {
  day: string;
  score: number;
  steps: number;
  active_calories: number;
  total_calories: number;
}

export async function upsertActivity(record: ActivityRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO activity_history (user_id, day, score, steps, active_calories, total_calories)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       score = excluded.score,
       steps = excluded.steps,
       active_calories = excluded.active_calories,
       total_calories = excluded.total_calories`,
    [
      userId,
      record.day,
      record.score,
      record.steps,
      record.active_calories,
      record.total_calories,
    ]
  );
}

// ─────────────────────────────────────────────────────────────
// Stress Operations
// ─────────────────────────────────────────────────────────────

export interface StressRecord {
  day: string;
  stress_duration: number;
  recovery_duration: number;
}

export async function upsertStress(record: StressRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO stress_history (user_id, day, stress_duration, recovery_duration)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       stress_duration = excluded.stress_duration,
       recovery_duration = excluded.recovery_duration`,
    [userId, record.day, record.stress_duration, record.recovery_duration]
  );
}

// ─────────────────────────────────────────────────────────────
// General History Queries
// ─────────────────────────────────────────────────────────────

export interface HistorySummary {
  sleep: SleepRecord[];
  readiness: ReadinessRecord[];
  activity: ActivityRecord[];
  stress: StressRecord[];
}

/**
 * Fetch combined health metrics for a date range (days ago)
 */
export async function getHistory(limitDays = 30, endDay?: string, userId: number = 1): Promise<HistorySummary> {
  const activeUserId = resolveUserId(userId);
  const db = await getDb();
  const whereClause = endDay ? "AND day <= ?" : "";
  const params = (clauseLimit: number) => endDay ? [activeUserId, endDay, clauseLimit] : [activeUserId, clauseLimit];

  // Query ranges based on day strings descending
  const sleep = await db.all<SleepRecord[]>(
    `SELECT day, score, duration, deep, rem, light, efficiency FROM sleep_history WHERE user_id = ? ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const readiness = await db.all<ReadinessRecord[]>(
    `SELECT day, score, hrv, rhr, temperature_deviation FROM readiness_history WHERE user_id = ? ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const activity = await db.all<ActivityRecord[]>(
    `SELECT day, score, steps, active_calories, total_calories FROM activity_history WHERE user_id = ? ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const stress = await db.all<StressRecord[]>(
    `SELECT day, stress_duration, recovery_duration FROM stress_history WHERE user_id = ? ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );

  return {
    // Return sorted ascending for visual charts
    sleep: sleep.reverse(),
    readiness: readiness.reverse(),
    activity: activity.reverse(),
    stress: stress.reverse(),
  };
}

// ─────────────────────────────────────────────────────────────
// User Profile Operations
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  age: number;
  weight_kg: number;
  height_cm: number;
  biological_sex: string;
  target_wake_time: string;
  goal: string;
  training_days: number;
}

export async function upsertUserProfile(profile: UserProfile, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_profile (user_id, age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       age = excluded.age,
       weight_kg = excluded.weight_kg,
       height_cm = excluded.height_cm,
       biological_sex = excluded.biological_sex,
       target_wake_time = excluded.target_wake_time,
       goal = excluded.goal,
       training_days = excluded.training_days`,
    [
      userId,
      profile.age,
      profile.weight_kg,
      profile.height_cm,
      profile.biological_sex,
      profile.target_wake_time,
      profile.goal,
      profile.training_days,
    ]
  );
}

export async function getUserProfile(userId: number = 1): Promise<UserProfile | null> {
  const db = await getDb();
  const profile = await db.get<UserProfile>(`SELECT age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days FROM user_profile WHERE user_id = ?`, [userId]);
  return profile || null;
}

// ─────────────────────────────────────────────────────────────
// User Targets Operations
// ─────────────────────────────────────────────────────────────

export interface UserTargets {
  sleep_need_seconds: number;
  recommended_bedtime: string;
  step_goal: number;
  max_hr: number;
  bmr_kcal: number;
}

export async function upsertUserTargets(targets: UserTargets, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_targets (user_id, sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       sleep_need_seconds = excluded.sleep_need_seconds,
       recommended_bedtime = excluded.recommended_bedtime,
       step_goal = excluded.step_goal,
       max_hr = excluded.max_hr,
       bmr_kcal = excluded.bmr_kcal`,
    [
      userId,
      targets.sleep_need_seconds,
      targets.recommended_bedtime,
      targets.step_goal,
      targets.max_hr,
      targets.bmr_kcal,
    ]
  );
}

export async function getUserTargets(userId: number = 1): Promise<UserTargets | null> {
  const db = await getDb();
  const targets = await db.get<UserTargets>(`SELECT sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal FROM user_targets WHERE user_id = ?`, [userId]);
  return targets || null;
}

// ─────────────────────────────────────────────────────────────
// Target History Operations
// ─────────────────────────────────────────────────────────────

export interface TargetHistoryRecord {
  id: number;
  target_id: string;
  old_value: string;
  new_value: string;
  reason: string;
  change_date: string;
}

export async function addTargetHistory(
  targetId: string,
  oldValue: string,
  newValue: string,
  reason: string,
  changeDate: string,
  userId: number = 1
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO target_history (user_id, target_id, old_value, new_value, reason, change_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, targetId, oldValue, newValue, reason, changeDate]
  );
}

export async function getTargetHistory(targetId?: string, userId: number = 1): Promise<TargetHistoryRecord[]> {
  const db = await getDb();
  if (targetId) {
    return db.all<TargetHistoryRecord[]>(
      `SELECT id, target_id, old_value, new_value, reason, change_date FROM target_history WHERE user_id = ? AND target_id = ? ORDER BY change_date DESC`,
      [userId, targetId]
    );
  }
  return db.all<TargetHistoryRecord[]>(`SELECT id, target_id, old_value, new_value, reason, change_date FROM target_history WHERE user_id = ? ORDER BY change_date DESC`, [userId]);
}

// ─────────────────────────────────────────────────────────────
// Raw Documents Operations
// ─────────────────────────────────────────────────────────────

export interface RawDocumentRecord {
  day: string;
  endpoint: string;
  doc_id: string;
  data: string;
}

export async function upsertRawDocument(
  day: string,
  endpoint: string,
  docId: string,
  data: any,
  userId: number = 1
): Promise<void> {
  const db = await getDb();
  const dataStr = JSON.stringify(data);
  await db.run(
    `INSERT INTO raw_documents (user_id, day, endpoint, doc_id, data)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day, endpoint, doc_id) DO UPDATE SET
       data = excluded.data`,
    [userId, day, endpoint, docId, dataStr]
  );
}

export async function getRawDocuments(
  endpoint: string,
  startDate?: string,
  endDate?: string,
  userId: number = 1
): Promise<any[]> {
  const activeUserId = resolveUserId(userId);
  const db = await getDb();
  let query = `SELECT data FROM raw_documents WHERE user_id = ? AND endpoint = ?`;
  const params: any[] = [activeUserId, endpoint];

  if (startDate) {
    query += ` AND day >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND day <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY day ASC`;
  const rows = await db.all<{ data: string }[]>(query, params);
  return rows.map((row: any) => JSON.parse(row.data));
}

// ─────────────────────────────────────────────────────────────
// Self-Experiments Operations
// ─────────────────────────────────────────────────────────────

export interface Experiment {
  id: string;
  title: string;
  behavior_text: string;
  metric_ids: string; // JSON array string
  direction_hypothesis: string;
  start_date: string;
  duration_days: number;
  status: string;
  confounder_warning: string;
}

export interface ExperimentDay {
  experiment_id: string;
  day: string;
  adherent: number;
}

export async function upsertExperiment(exp: Experiment, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO experiments (user_id, id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, id) DO UPDATE SET
       title = excluded.title,
       behavior_text = excluded.behavior_text,
       metric_ids = excluded.metric_ids,
       direction_hypothesis = excluded.direction_hypothesis,
       start_date = excluded.start_date,
       duration_days = excluded.duration_days,
       status = excluded.status,
       confounder_warning = excluded.confounder_warning`,
    [
      userId,
      exp.id,
      exp.title,
      exp.behavior_text,
      exp.metric_ids,
      exp.direction_hypothesis,
      exp.start_date,
      exp.duration_days,
      exp.status,
      exp.confounder_warning,
    ]
  );
}

export async function getExperiments(userId: number = 1): Promise<Experiment[]> {
  const db = await getDb();
  return db.all<Experiment[]>(`SELECT id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning FROM experiments WHERE user_id = ? ORDER BY start_date DESC`, [userId]);
}

export async function upsertExperimentDay(dayRecord: ExperimentDay, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO experiment_days (user_id, experiment_id, day, adherent)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, experiment_id, day) DO UPDATE SET
       adherent = excluded.adherent`,
    [userId, dayRecord.experiment_id, dayRecord.day, dayRecord.adherent]
  );
}

export async function getExperimentDays(experimentId: string, userId: number = 1): Promise<ExperimentDay[]> {
  const db = await getDb();
  return db.all<ExperimentDay[]>(
    `SELECT experiment_id, day, adherent FROM experiment_days WHERE user_id = ? AND experiment_id = ? ORDER BY day ASC`,
    [userId, experimentId]
  );
}

// ─────────────────────────────────────────────────────────────
// Anomalies Operations
// ─────────────────────────────────────────────────────────────

export interface AnomalyRecord {
  day: string;
  metric_id: string;
  value: number;
  z_score: number;
}

export async function upsertAnomaly(anomaly: AnomalyRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO anomalies (user_id, day, metric_id, value, z_score)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, day, metric_id) DO UPDATE SET
       value = excluded.value,
       z_score = excluded.z_score`,
    [userId, anomaly.day, anomaly.metric_id, anomaly.value, anomaly.z_score]
  );
}

export async function getAnomalies(limit = 100, userId: number = 1): Promise<AnomalyRecord[]> {
  const db = await getDb();
  return db.all<AnomalyRecord[]>(
    `SELECT day, metric_id, value, z_score FROM anomalies WHERE user_id = ? ORDER BY day DESC LIMIT ?`,
    [userId, limit]
  );
}

// ─────────────────────────────────────────────────────────────
// Digest Logs Operations
// ─────────────────────────────────────────────────────────────

export interface DigestLogRecord {
  date: string;
  channel: string;
  sent_at: string;
  had_data: number;
}

export async function upsertDigestLog(log: DigestLogRecord, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO digest_log (user_id, date, channel, sent_at, had_data)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       channel = excluded.channel,
       sent_at = excluded.sent_at,
       had_data = excluded.had_data`,
    [userId, log.date, log.channel, log.sent_at, log.had_data]
  );
}

export async function getDigestLog(date: string, userId: number = 1): Promise<DigestLogRecord | null> {
  const db = await getDb();
  const row = await db.get<DigestLogRecord>(
    `SELECT date, channel, sent_at, had_data FROM digest_log WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  return row || null;
}

// ─────────────────────────────────────────────────────────────
// Alert Preferences Operations
// ─────────────────────────────────────────────────────────────

export interface AlertPreference {
  alert_type: string;
  muted: number;
  muted_at?: string;
}

export async function setAlertMute(alertType: string, muted: number, userId: number = 1): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO alert_prefs (user_id, alert_type, muted, muted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, alert_type) DO UPDATE SET
       muted = excluded.muted,
       muted_at = excluded.muted_at`,
    [userId, alertType, muted, muted ? new Date().toISOString() : null]
  );
}

export async function getAlertPreferences(userId: number = 1): Promise<AlertPreference[]> {
  const db = await getDb();
  return db.all<AlertPreference[]>(`SELECT alert_type, muted, muted_at FROM alert_prefs WHERE user_id = ?`, [userId]);
}

// ─────────────────────────────────────────────────────────────
// Sync Log Operations
// ─────────────────────────────────────────────────────────────

export interface SyncEndpointResult {
  key: string;
  label: string;
  group: string;
  status: "pending" | "running" | "done" | "error";
  records: number;
  error?: string;
}

export interface SyncLogEntry {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger_source: string;
  start_date: string;
  end_date: string;
  status: "running" | "success" | "partial" | "error";
  synced_days: number;
  new_days: number;
  total_records: number;
  endpoints: SyncEndpointResult[];
  error: string | null;
}

export async function insertSyncLog(entry: {
  started_at: string;
  trigger_source: string;
  start_date: string;
  end_date: string;
}, userId: number = 1): Promise<number> {
  const db = await getDb();
  const result: any = await db.run(
    `INSERT INTO sync_log (user_id, started_at, trigger_source, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, 'running')`,
    [userId, entry.started_at, entry.trigger_source, entry.start_date, entry.end_date]
  );
  if (result?.lastID) return result.lastID;
  // Postgres wrapper cannot return lastID — fall back to the newest row
  const row = await db.get<{ id: number }>(`SELECT id FROM sync_log WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]);
  return row?.id ?? 0;
}

export async function finalizeSyncLog(
  id: number,
  update: {
    status: "success" | "partial" | "error";
    synced_days: number;
    new_days: number;
    total_records: number;
    endpoints: SyncEndpointResult[];
    error?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE sync_log SET
       finished_at = ?, status = ?, synced_days = ?, new_days = ?,
       total_records = ?, endpoints = ?, error = ?
     WHERE id = ?`,
    [
      new Date().toISOString(),
      update.status,
      update.synced_days,
      update.new_days,
      update.total_records,
      JSON.stringify(update.endpoints),
      update.error ?? null,
      id,
    ]
  );
}

export async function getSyncLog(limit = 20, userId: number = 1): Promise<SyncLogEntry[]> {
  const db = await getDb();
  const rows = await db.all<any[]>(
    `SELECT * FROM sync_log WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map((row) => ({
    ...row,
    endpoints: row.endpoints ? JSON.parse(row.endpoints) : [],
  }));
}

/**
 * Distinct days already present in the core history tables.
 * Used to distinguish brand-new days from re-synced ones. Deliberately
 * unfiltered: Oura sometimes returns documents dated outside the requested
 * range, and those must still count as "known" on the next sync.
 */
export async function getKnownDays(userId: number = 1): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.all<Array<{ day: string }>>(
    `SELECT day FROM sleep_history WHERE user_id = ?
     UNION SELECT day FROM readiness_history WHERE user_id = ?
     UNION SELECT day FROM activity_history WHERE user_id = ?
     UNION SELECT day FROM stress_history WHERE user_id = ?`,
    [userId, userId, userId, userId]
  );
  return new Set(rows.map((r) => r.day));
}

async function tableExists(db: DatabaseWrapper, tableName: string): Promise<boolean> {
  try {
    const row = isPostgres
      ? await db.get(`SELECT table_name FROM information_schema.tables WHERE table_name = ?`, [tableName])
      : await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, [tableName]);
    return !!row;
  } catch (err) {
    return false;
  }
}

async function runDbMigration(db: DatabaseWrapper): Promise<void> {
  // Check if sleep_history exists and has user_id column
  const sleepExists = await tableExists(db, "sleep_history");
  if (sleepExists) {
    const sleepInfo = await db.all<any[]>(
      isPostgres
        ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'sleep_history' AND column_name = 'user_id'`
        : `PRAGMA table_info(sleep_history)`
    );
    const sleepHasUserId = isPostgres
      ? sleepInfo.length > 0
      : sleepInfo.some((c) => c.name === "user_id");

    if (sleepHasUserId) {
      return; // Migration already run
    }
  }

  console.log("[DB] Upgrading schema to support multi-user authentication...");

  // 1. Create new authentication/settings tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      last_seen TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER
    );

    CREATE TABLE IF NOT EXISTS oura_connections (
      user_id INTEGER PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      scopes TEXT,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_sync_at TEXT,
      sync_error TEXT
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT NOT NULL,
      attempted TEXT NOT NULL
    );
  `);

  // Helper to safely migrate a table if it exists
  const migrateTable = async (
    tableName: string,
    newSchemaSql: string,
    selectCols: string,
    insertCols: string
  ) => {
    const exists = await tableExists(db, tableName);
    if (!exists) return;

    console.log(`[DB] Migrating table '${tableName}' to support user-scoping...`);
    const tempName = `temp_${tableName}`;
    
    // Rename old table
    await db.exec(`ALTER TABLE ${tableName} RENAME TO ${tempName}`);
    
    // Create new table
    await db.exec(newSchemaSql);
    
    // Copy data, defaulting user_id = 1
    await db.exec(`
      INSERT INTO ${tableName} (user_id, ${insertCols})
      SELECT 1 AS user_id, ${selectCols} FROM ${tempName}
    `);
    
    // Drop old table
    await db.exec(`DROP TABLE ${tempName}`);
  };

  // Run migrations for each table
  await migrateTable(
    "sleep_history",
    `CREATE TABLE sleep_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      duration INTEGER,
      deep INTEGER,
      rem INTEGER,
      light INTEGER,
      efficiency INTEGER,
      PRIMARY KEY (user_id, day)
    )`,
    "day, score, duration, deep, rem, light, efficiency",
    "day, score, duration, deep, rem, light, efficiency"
  );

  await migrateTable(
    "readiness_history",
    `CREATE TABLE readiness_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      hrv INTEGER,
      rhr INTEGER,
      temperature_deviation REAL,
      PRIMARY KEY (user_id, day)
    )`,
    "day, score, hrv, rhr, temperature_deviation",
    "day, score, hrv, rhr, temperature_deviation"
  );

  await migrateTable(
    "activity_history",
    `CREATE TABLE activity_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      score INTEGER,
      steps INTEGER,
      active_calories INTEGER,
      total_calories INTEGER,
      PRIMARY KEY (user_id, day)
    )`,
    "day, score, steps, active_calories, total_calories",
    "day, score, steps, active_calories, total_calories"
  );

  await migrateTable(
    "stress_history",
    `CREATE TABLE stress_history (
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      stress_duration INTEGER,
      recovery_duration INTEGER,
      PRIMARY KEY (user_id, day)
    )`,
    "day, stress_duration, recovery_duration",
    "day, stress_duration, recovery_duration"
  );

  await migrateTable(
    "user_profile",
    `CREATE TABLE user_profile (
      user_id INTEGER PRIMARY KEY,
      age INTEGER,
      weight_kg REAL,
      height_cm REAL,
      biological_sex TEXT,
      target_wake_time TEXT,
      goal TEXT,
      training_days INTEGER
    )`,
    "age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days",
    "age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days"
  );

  await migrateTable(
    "user_targets",
    `CREATE TABLE user_targets (
      user_id INTEGER PRIMARY KEY,
      sleep_need_seconds INTEGER,
      recommended_bedtime TEXT,
      step_goal INTEGER,
      max_hr INTEGER,
      bmr_kcal REAL
    )`,
    "sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal",
    "sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal"
  );

  await migrateTable(
    "target_history",
    `CREATE TABLE target_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_id TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      change_date TEXT
    )`,
    "target_id, old_value, new_value, reason, change_date",
    "target_id, old_value, new_value, reason, change_date"
  );

  await migrateTable(
    "raw_documents",
    `CREATE TABLE raw_documents (
      user_id INTEGER NOT NULL,
      day TEXT,
      endpoint TEXT,
      doc_id TEXT,
      data TEXT,
      PRIMARY KEY (user_id, day, endpoint, doc_id)
    )`,
    "day, endpoint, doc_id, data",
    "day, endpoint, doc_id, data"
  );

  await migrateTable(
    "experiments",
    `CREATE TABLE experiments (
      user_id INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      title TEXT,
      behavior_text TEXT,
      metric_ids TEXT,
      direction_hypothesis TEXT,
      start_date TEXT,
      duration_days INTEGER,
      status TEXT,
      confounder_warning TEXT
    )`,
    "id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning",
    "id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning"
  );

  await migrateTable(
    "experiment_days",
    `CREATE TABLE experiment_days (
      user_id INTEGER NOT NULL,
      experiment_id TEXT,
      day TEXT,
      adherent INTEGER,
      PRIMARY KEY (user_id, experiment_id, day)
    )`,
    "experiment_id, day, adherent",
    "experiment_id, day, adherent"
  );

  await migrateTable(
    "anomalies",
    `CREATE TABLE anomalies (
      user_id INTEGER NOT NULL,
      day TEXT,
      metric_id TEXT,
      value REAL,
      z_score REAL,
      PRIMARY KEY (user_id, day, metric_id)
    )`,
    "day, metric_id, value, z_score",
    "day, metric_id, value, z_score"
  );

  await migrateTable(
    "digest_log",
    `CREATE TABLE digest_log (
      user_id INTEGER NOT NULL,
      date TEXT,
      channel TEXT,
      sent_at TEXT,
      had_data INTEGER,
      PRIMARY KEY (user_id, date)
    )`,
    "date, channel, sent_at, had_data",
    "date, channel, sent_at, had_data"
  );

  await migrateTable(
    "alert_prefs",
    `CREATE TABLE alert_prefs (
      user_id INTEGER NOT NULL,
      alert_type TEXT,
      muted INTEGER DEFAULT 0,
      muted_at TEXT,
      PRIMARY KEY (user_id, alert_type)
    )`,
    "alert_type, muted, muted_at",
    "alert_type, muted, muted_at"
  );

  await migrateTable(
    "sync_log",
    `CREATE TABLE sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      trigger_source TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      synced_days INTEGER DEFAULT 0,
      new_days INTEGER DEFAULT 0,
      total_records INTEGER DEFAULT 0,
      endpoints TEXT,
      error TEXT
    )`,
    "started_at, finished_at, trigger_source, start_date, end_date, status, synced_days, new_days, total_records, endpoints, error",
    "started_at, finished_at, trigger_source, start_date, end_date, status, synced_days, new_days, total_records, endpoints, error"
  );

  console.log("[DB] Schema upgrade to support multi-user authentication completed successfully!");
}
