import { getDb, upsertStress } from '../src/db.js';
import { performance } from 'perf_hooks';
import { rmSync } from 'fs';

async function run() {
  try { rmSync('oura-data.sqlite'); } catch (e) {}
  const db = await getDb();

  const data = [];
  for (let i = 0; i < 365; i++) {
    data.push({
      day: `2023-01-${i.toString().padStart(2, '0')}`,
      stress_high: Math.random() * 1000,
      recovery_high: Math.random() * 1000,
    });
  }

  let start = performance.now();
  for (const str of data) {
    await upsertStress({
      day: str.day,
      stress_duration: str.stress_high ?? 0,
      recovery_duration: str.recovery_high ?? 0,
    });
  }
  let end = performance.now();
  const seqTime = end - start;
  console.log(`Sequential Await: ${seqTime} ms`);

  await db.exec('DELETE FROM stress_history');
  start = performance.now();
  await db.run('BEGIN TRANSACTION');
  for (const str of data) {
    await db.run(
        `INSERT INTO stress_history (day, stress_duration, recovery_duration)
         VALUES (?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET
           stress_duration = excluded.stress_duration,
           recovery_duration = excluded.recovery_duration`,
        [str.day, str.stress_high ?? 0, str.recovery_high ?? 0]
    );
  }
  await db.run('COMMIT');
  end = performance.now();
  const txTime = end - start;
  console.log(`Transaction Loop: ${txTime} ms`);
  console.log(`Transaction Loop Speedup: ${(seqTime / txTime).toFixed(2)}x`);

  await db.exec('DELETE FROM stress_history');
  start = performance.now();
  if (data.length > 0) {
    const placeholders = data.map(() => '(?, ?, ?)').join(',');
    const values = data.flatMap(d => [d.day, d.stress_high ?? 0, d.recovery_high ?? 0]);
    await db.run(
        `INSERT INTO stress_history (day, stress_duration, recovery_duration)
         VALUES ${placeholders}
         ON CONFLICT(day) DO UPDATE SET
           stress_duration = excluded.stress_duration,
           recovery_duration = excluded.recovery_duration`,
        values
    );
  }
  end = performance.now();
  const bulkTime = end - start;
  console.log(`Bulk Insert: ${bulkTime} ms`);
  console.log(`Bulk Insert Speedup: ${(seqTime / bulkTime).toFixed(2)}x`);
}

run().catch(console.error);
