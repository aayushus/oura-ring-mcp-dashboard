import { getDb, upsertStress } from '../src/db.js';
import { performance } from 'perf_hooks';
import { rmSync } from 'fs';

async function run() {
  // Setup DB
  try { rmSync('oura-data.sqlite'); } catch (e) {}
  const db = await getDb();

  // Create fake data
  const data = [];
  for (let i = 0; i < 365; i++) {
    data.push({
      day: `2023-01-${i.toString().padStart(2, '0')}`,
      stress_high: Math.random() * 1000,
      recovery_high: Math.random() * 1000,
    });
  }

  // Measure Sequential
  await db.exec('DELETE FROM stress_history');
  let start = performance.now();
  for (const str of data) {
    await upsertStress({
      day: str.day,
      stress_duration: str.stress_high ?? 0,
      recovery_duration: str.recovery_high ?? 0,
    });
  }
  let end = performance.now();
  console.log(`Sequential Await: ${end - start} ms`);

  // Measure Promise.all
  await db.exec('DELETE FROM stress_history');
  start = performance.now();
  const promises = data.map(str => upsertStress({
    day: str.day,
    stress_duration: str.stress_high ?? 0,
    recovery_duration: str.recovery_high ?? 0,
  }));
  await Promise.all(promises);
  end = performance.now();
  console.log(`Promise.all: ${end - start} ms`);
}

run().catch(console.error);
