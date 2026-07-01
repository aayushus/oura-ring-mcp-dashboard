/**
 * SQLite Database Manager for Oura Ring health history
 */

import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";

const CONFIG_DIR = join(homedir(), ".oura-mcp");
const DB_FILE = process.env.NODE_ENV === "test" ? ":memory:" : join(CONFIG_DIR, "oura-health.db");

let dbInstance: Database | null = null;

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

/**
 * Initialize and open the database, creating tables if they do not exist
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  await ensureConfigDir();

  // Open the database using sqlite3 driver
  dbInstance = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  // Create tables
  await dbInstance.exec(`
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
  `);

  return dbInstance;
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
export async function getHistory(limitDays = 30): Promise<HistorySummary> {
  const db = await getDb();

  // Query ranges based on day strings descending
  const sleep = await db.all<SleepRecord[]>(
    `SELECT * FROM sleep_history ORDER BY day DESC LIMIT ?`,
    [limitDays]
  );
  const readiness = await db.all<ReadinessRecord[]>(
    `SELECT * FROM readiness_history ORDER BY day DESC LIMIT ?`,
    [limitDays]
  );
  const activity = await db.all<ActivityRecord[]>(
    `SELECT * FROM activity_history ORDER BY day DESC LIMIT ?`,
    [limitDays]
  );
  const stress = await db.all<StressRecord[]>(
    `SELECT * FROM stress_history ORDER BY day DESC LIMIT ?`,
    [limitDays]
  );

  return {
    // Return sorted ascending for visual charts
    sleep: sleep.reverse(),
    readiness: readiness.reverse(),
    activity: activity.reverse(),
    stress: stress.reverse(),
  };
}
