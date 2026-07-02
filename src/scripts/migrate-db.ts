/**
 * Automatic Database Migration Script: SQLite -> PostgreSQL
 */

import { open } from "sqlite";
import sqlite3 from "sqlite3";
import pg from "pg";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Find database file
const localHostPath = join(process.cwd(), "oura_credentials", "oura-health.db");
const containerPath = join(homedir(), ".oura-mcp", "oura-health.db");
let sqliteFile = existsSync(containerPath) ? containerPath : (existsSync(localHostPath) ? localHostPath : null);

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/oura_health";
  
  console.log(`[Migration] Target PostgreSQL URL: ${dbUrl}`);
  console.log(`[Migration] Source SQLite Database: ${sqliteFile}`);

  if (!sqliteFile) {
    console.log("[Migration] No local SQLite database file found to migrate. Skipping.");
    process.exit(0);
  }

  // Open SQLite source
  const sqliteDb = await open({
    filename: sqliteFile!,
    driver: sqlite3.Database,
  });

  // Open PostgreSQL target pool
  const pool = new pg.Pool({ connectionString: dbUrl });
  const pgClient = await pool.connect();

  console.log("[Migration] Connected to target PostgreSQL. Performing migration...");

  const tables = [
    { name: "sleep_history", columns: ["day", "score", "duration", "deep", "rem", "light", "efficiency"] },
    { name: "readiness_history", columns: ["day", "score", "hrv", "rhr", "temperature_deviation"] },
    { name: "activity_history", columns: ["day", "score", "steps", "active_calories", "total_calories"] },
    { name: "stress_history", columns: ["day", "stress_duration", "recovery_duration"] },
    { name: "user_profile", columns: ["id", "age", "weight_kg", "height_cm", "biological_sex", "target_wake_time", "goal", "training_days"] },
    { name: "user_targets", columns: ["id", "sleep_need_seconds", "recommended_bedtime", "step_goal", "max_hr", "bmr_kcal"] },
    { name: "target_history", columns: ["id", "target_id", "old_value", "new_value", "reason", "change_date"] },
    { name: "raw_documents", columns: ["day", "endpoint", "doc_id", "data"] },
    { name: "experiments", columns: ["id", "title", "behavior_text", "metric_ids", "direction_hypothesis", "start_date", "duration_days", "status", "confounder_warning"] },
    { name: "experiment_days", columns: ["experiment_id", "day", "adherent"] },
    { name: "anomalies", columns: ["day", "metric_id", "value", "z_score"] },
    { name: "digest_log", columns: ["date", "channel", "sent_at", "had_data"] },
    { name: "alert_prefs", columns: ["alert_type", "muted", "muted_at"] }
  ];

  for (const table of tables) {
    try {
      console.log(`[Migration] Migrating table '${table.name}'...`);
      
      // Check if table exists in SQLite
      const sqliteTableCheck = await sqliteDb.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table.name]);
      if (!sqliteTableCheck) {
        console.log(`[Migration] Table '${table.name}' does not exist in SQLite. Skipping.`);
        continue;
      }

      const rows = await sqliteDb.all(`SELECT * FROM ${table.name}`);
      console.log(`[Migration] Found ${rows.length} rows inside SQLite table '${table.name}'.`);

      if (rows.length === 0) continue;

      // Migrate each row to PostgreSQL
      for (const row of rows) {
        const columnsStr = table.columns.join(", ");
        const placeholders = table.columns.map((_, idx) => `$${idx + 1}`).join(", ");
        const values = table.columns.map(col => row[col]);

        let conflictClause = "";
        if (table.name === "sleep_history" || table.name === "readiness_history" || table.name === "activity_history" || table.name === "stress_history") {
          conflictClause = "ON CONFLICT(day) DO NOTHING";
        } else if (table.name === "user_profile" || table.name === "user_targets") {
          conflictClause = "ON CONFLICT(id) DO NOTHING";
        } else if (table.name === "raw_documents") {
          conflictClause = "ON CONFLICT(day, endpoint, doc_id) DO NOTHING";
        } else if (table.name === "experiments") {
          conflictClause = "ON CONFLICT(id) DO NOTHING";
        } else if (table.name === "experiment_days") {
          conflictClause = "ON CONFLICT(experiment_id, day) DO NOTHING";
        } else if (table.name === "anomalies") {
          conflictClause = "ON CONFLICT(day, metric_id) DO NOTHING";
        } else if (table.name === "digest_log") {
          conflictClause = "ON CONFLICT(date) DO NOTHING";
        } else if (table.name === "alert_prefs") {
          conflictClause = "ON CONFLICT(alert_type) DO NOTHING";
        } else if (table.name === "target_history") {
          conflictClause = "ON CONFLICT(id) DO NOTHING";
        }

        const insertSql = `INSERT INTO ${table.name} (${columnsStr}) VALUES (${placeholders}) ${conflictClause}`;
        await pgClient.query(insertSql, values);
      }
      console.log(`[Migration] Successfully completed migration of table '${table.name}'.`);
    } catch (err) {
      console.error(`[Migration] Failed to migrate table '${table.name}':`, err);
    }
  }

  // Release connections
  pgClient.release();
  await sqliteDb.close();
  await pool.end();

  // Rename source SQLite database file so we don't migrate again on next startup
  try {
    const { renameSync } = await import("node:fs");
    renameSync(sqliteFile!, `${sqliteFile}.migrated`);
    console.log(`[Migration] Renamed SQLite source to ${sqliteFile}.migrated`);
  } catch (err) {
    console.error("[Migration] Failed to rename SQLite database file:", err);
  }

  console.log("[Migration] SQLite to PostgreSQL database migration completed successfully!");
}

migrate().catch((err) => {
  console.error("[Migration] Fatal migration error:", err);
  process.exit(1);
});
