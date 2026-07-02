/**
 * Dual Database Manager (PostgreSQL / SQLite) for Oura Ring health history
 */

import { open } from "sqlite";
import sqlite3 from "sqlite3";
import pg from "pg";
import { homedir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";

const CONFIG_DIR = join(homedir(), ".oura-mcp");
const DB_FILE = process.env.NODE_ENV === "test" ? ":memory:" : join(CONFIG_DIR, "oura-health.db");

export interface DatabaseWrapper {
  exec(sql: string): Promise<void>;
  all<T = any>(sql: string, params?: any[]): Promise<T>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ changes?: number; lastID?: number }>;
  close(): Promise<void>;
}

let dbInstance: DatabaseWrapper | null = null;
let isPostgres = false;

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
          .replace(/PRIMARY KEY\s*\(\s*day\s*,\s*endpoint\s*,\s*doc_id\s*\)/gi, "PRIMARY KEY (day, endpoint, doc_id)");
        
        await pool.query(pgSql);
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

  // Create tables
  await dbInstance!.exec(`
    CREATE TABLE IF NOT EXISTS sleep_history (
      day TEXT PRIMARY KEY,
      score INTEGER,
      duration INTEGER,
      deep INTEGER,
      rem INTEGER,
      light INTEGER,
      efficiency INTEGER
    );

    CREATE TABLE IF NOT EXISTS readiness_history (
      day TEXT PRIMARY KEY,
      score INTEGER,
      hrv INTEGER,
      rhr INTEGER,
      temperature_deviation REAL
    );

    CREATE TABLE IF NOT EXISTS activity_history (
      day TEXT PRIMARY KEY,
      score INTEGER,
      steps INTEGER,
      active_calories INTEGER,
      total_calories INTEGER
    );

    CREATE TABLE IF NOT EXISTS stress_history (
      day TEXT PRIMARY KEY,
      stress_duration INTEGER,
      recovery_duration INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      age INTEGER,
      weight_kg REAL,
      height_cm REAL,
      biological_sex TEXT,
      target_wake_time TEXT,
      goal TEXT,
      training_days INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_targets (
      id INTEGER PRIMARY KEY,
      sleep_need_seconds INTEGER,
      recommended_bedtime TEXT,
      step_goal INTEGER,
      max_hr INTEGER,
      bmr_kcal REAL
    );

    CREATE TABLE IF NOT EXISTS target_history (
      id SERIAL PRIMARY KEY,
      target_id TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      change_date TEXT
    );

    CREATE TABLE IF NOT EXISTS raw_documents (
      day TEXT,
      endpoint TEXT,
      doc_id TEXT,
      data TEXT,
      PRIMARY KEY (day, endpoint, doc_id)
    );

    CREATE TABLE IF NOT EXISTS experiments (
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
      experiment_id TEXT,
      day TEXT,
      adherent INTEGER,
      PRIMARY KEY (experiment_id, day)
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      day TEXT,
      metric_id TEXT,
      value REAL,
      z_score REAL,
      PRIMARY KEY (day, metric_id)
    );

    CREATE TABLE IF NOT EXISTS digest_log (
      date TEXT PRIMARY KEY,
      channel TEXT,
      sent_at TEXT,
      had_data INTEGER
    );

    CREATE TABLE IF NOT EXISTS alert_prefs (
      alert_type TEXT PRIMARY KEY,
      muted INTEGER DEFAULT 0,
      muted_at TEXT
    );
  `);

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

export async function upsertSleep(record: SleepRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO sleep_history (day, score, duration, deep, rem, light, efficiency)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       score = excluded.score,
       duration = excluded.duration,
       deep = excluded.deep,
       rem = excluded.rem,
       light = excluded.light,
       efficiency = excluded.efficiency`,
    [
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

export async function upsertReadiness(record: ReadinessRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO readiness_history (day, score, hrv, rhr, temperature_deviation)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       score = excluded.score,
       hrv = excluded.hrv,
       rhr = excluded.rhr,
       temperature_deviation = excluded.temperature_deviation`,
    [
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

export async function upsertActivity(record: ActivityRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO activity_history (day, score, steps, active_calories, total_calories)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       score = excluded.score,
       steps = excluded.steps,
       active_calories = excluded.active_calories,
       total_calories = excluded.total_calories`,
    [
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

export async function upsertStress(record: StressRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO stress_history (day, stress_duration, recovery_duration)
     VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       stress_duration = excluded.stress_duration,
       recovery_duration = excluded.recovery_duration`,
    [record.day, record.stress_duration, record.recovery_duration]
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
export async function getHistory(limitDays = 30, endDay?: string): Promise<HistorySummary> {
  const db = await getDb();
  const whereClause = endDay ? "WHERE day <= ?" : "";
  const params = (clauseLimit: number) => endDay ? [endDay, clauseLimit] : [clauseLimit];

  // Query ranges based on day strings descending
  const sleep = await db.all<SleepRecord[]>(
    `SELECT * FROM sleep_history ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const readiness = await db.all<ReadinessRecord[]>(
    `SELECT * FROM readiness_history ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const activity = await db.all<ActivityRecord[]>(
    `SELECT * FROM activity_history ${whereClause} ORDER BY day DESC LIMIT ?`,
    params(limitDays)
  );
  const stress = await db.all<StressRecord[]>(
    `SELECT * FROM stress_history ${whereClause} ORDER BY day DESC LIMIT ?`,
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

export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_profile (id, age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       age = excluded.age,
       weight_kg = excluded.weight_kg,
       height_cm = excluded.height_cm,
       biological_sex = excluded.biological_sex,
       target_wake_time = excluded.target_wake_time,
       goal = excluded.goal,
       training_days = excluded.training_days`,
    [
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

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDb();
  const profile = await db.get<UserProfile>(`SELECT age, weight_kg, height_cm, biological_sex, target_wake_time, goal, training_days FROM user_profile WHERE id = 1`);
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

export async function upsertUserTargets(targets: UserTargets): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_targets (id, sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sleep_need_seconds = excluded.sleep_need_seconds,
       recommended_bedtime = excluded.recommended_bedtime,
       step_goal = excluded.step_goal,
       max_hr = excluded.max_hr,
       bmr_kcal = excluded.bmr_kcal`,
    [
      targets.sleep_need_seconds,
      targets.recommended_bedtime,
      targets.step_goal,
      targets.max_hr,
      targets.bmr_kcal,
    ]
  );
}

export async function getUserTargets(): Promise<UserTargets | null> {
  const db = await getDb();
  const targets = await db.get<UserTargets>(`SELECT sleep_need_seconds, recommended_bedtime, step_goal, max_hr, bmr_kcal FROM user_targets WHERE id = 1`);
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
  changeDate: string
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO target_history (target_id, old_value, new_value, reason, change_date)
     VALUES (?, ?, ?, ?, ?)`,
    [targetId, oldValue, newValue, reason, changeDate]
  );
}

export async function getTargetHistory(targetId?: string): Promise<TargetHistoryRecord[]> {
  const db = await getDb();
  if (targetId) {
    return db.all<TargetHistoryRecord[]>(
      `SELECT * FROM target_history WHERE target_id = ? ORDER BY change_date DESC`,
      [targetId]
    );
  }
  return db.all<TargetHistoryRecord[]>(`SELECT * FROM target_history ORDER BY change_date DESC`);
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
  data: any
): Promise<void> {
  const db = await getDb();
  const dataStr = JSON.stringify(data);
  await db.run(
    `INSERT INTO raw_documents (day, endpoint, doc_id, data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day, endpoint, doc_id) DO UPDATE SET
       data = excluded.data`,
    [day, endpoint, docId, dataStr]
  );
}

export async function getRawDocuments(
  endpoint: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  const db = await getDb();
  let query = `SELECT data FROM raw_documents WHERE endpoint = ?`;
  const params: any[] = [endpoint];

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

export async function upsertExperiment(exp: Experiment): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO experiments (id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       behavior_text = excluded.behavior_text,
       metric_ids = excluded.metric_ids,
       direction_hypothesis = excluded.direction_hypothesis,
       start_date = excluded.start_date,
       duration_days = excluded.duration_days,
       status = excluded.status,
       confounder_warning = excluded.confounder_warning`,
    [
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

export async function getExperiments(): Promise<Experiment[]> {
  const db = await getDb();
  return db.all<Experiment[]>(`SELECT * FROM experiments ORDER BY start_date DESC`);
}

export async function upsertExperimentDay(dayRecord: ExperimentDay): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO experiment_days (experiment_id, day, adherent)
     VALUES (?, ?, ?)
     ON CONFLICT(experiment_id, day) DO UPDATE SET
       adherent = excluded.adherent`,
    [dayRecord.experiment_id, dayRecord.day, dayRecord.adherent]
  );
}

export async function getExperimentDays(experimentId: string): Promise<ExperimentDay[]> {
  const db = await getDb();
  return db.all<ExperimentDay[]>(
    `SELECT * FROM experiment_days WHERE experiment_id = ? ORDER BY day ASC`,
    [experimentId]
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

export async function upsertAnomaly(anomaly: AnomalyRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO anomalies (day, metric_id, value, z_score)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day, metric_id) DO UPDATE SET
       value = excluded.value,
       z_score = excluded.z_score`,
    [anomaly.day, anomaly.metric_id, anomaly.value, anomaly.z_score]
  );
}

export async function getAnomalies(limit = 100): Promise<AnomalyRecord[]> {
  const db = await getDb();
  return db.all<AnomalyRecord[]>(
    `SELECT * FROM anomalies ORDER BY day DESC LIMIT ?`,
    [limit]
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

export async function upsertDigestLog(log: DigestLogRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO digest_log (date, channel, sent_at, had_data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       channel = excluded.channel,
       sent_at = excluded.sent_at,
       had_data = excluded.had_data`,
    [log.date, log.channel, log.sent_at, log.had_data]
  );
}

export async function getDigestLog(date: string): Promise<DigestLogRecord | null> {
  const db = await getDb();
  const row = await db.get<DigestLogRecord>(
    `SELECT * FROM digest_log WHERE date = ?`,
    [date]
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

export async function setAlertMute(alertType: string, muted: number): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO alert_prefs (alert_type, muted, muted_at)
     VALUES (?, ?, ?)
     ON CONFLICT(alert_type) DO UPDATE SET
       muted = excluded.muted,
       muted_at = excluded.muted_at`,
    [alertType, muted, muted ? new Date().toISOString() : null]
  );
}

export async function getAlertPreferences(): Promise<AlertPreference[]> {
  const db = await getDb();
  return db.all<AlertPreference[]>(`SELECT * FROM alert_prefs`);
}
