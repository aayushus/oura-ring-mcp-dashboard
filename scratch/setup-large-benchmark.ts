import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";

async function setup() {
  const dir = join(process.cwd(), "oura_credentials");
  try { mkdirSync(dir, { recursive: true }); } catch (e) {}

  const db = await open({
    filename: join(dir, "oura-health.db"),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sleep_history (day TEXT, score INTEGER, duration INTEGER, deep INTEGER, rem INTEGER, light INTEGER, efficiency INTEGER);
  `);

  await db.exec("BEGIN TRANSACTION");
  for (let i = 0; i < 50000; i++) {
    await db.run(
      `INSERT INTO sleep_history (day, score, duration, deep, rem, light, efficiency) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`2023-01-${i % 31}`, 85, 28000, 5000, 6000, 15000, 90]
    );
  }
  await db.exec("COMMIT");

  console.log("Mock SQLite database created with 50000 rows.");
}

setup();
