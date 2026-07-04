import { runMigration } from "../src/scripts/migrate-db.js";
import pg from "pg";

async function main() {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/oura_health_test";

  // create database
  const pool = new pg.Pool({ connectionString: "postgresql://postgres:postgres@localhost:5432/postgres" });
  await pool.query("DROP DATABASE IF EXISTS oura_health_test");
  await pool.query("CREATE DATABASE oura_health_test");
  await pool.end();

  console.log("Starting migration benchmark...");
  const start = performance.now();
  await runMigration();
  const end = performance.now();

  console.log(`Migration completed in ${(end - start).toFixed(2)} ms`);
}

main().catch(console.error);
