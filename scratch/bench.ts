import { getExperiments, getExperimentDays, getDb, upsertExperiment } from '../src/db';
import { performance } from 'perf_hooks';

async function main() {
    process.env.DB_PATH = 'scratch/test.db';
    const db = await getDb();

    // Setup tables
    await db.exec(`
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
    `);

    const userId = 999;

    // generate 100 experiments
    for (let i = 0; i < 100; i++) {
        await db.run(
            `INSERT OR IGNORE INTO experiments (id, user_id, title, behavior_text, metric_ids, direction_hypothesis, start_date, duration_days, status, confounder_warning)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`exp-${i}`, userId, `Experiment ${i}`, 'Text', JSON.stringify(['metric1']), 'up', '2023-01-01', 10, 'active', '']
        );

        for (let j = 0; j < 10; j++) {
            await db.run(
                `INSERT OR IGNORE INTO experiment_days (user_id, experiment_id, day, adherent) VALUES (?, ?, ?, ?)`,
                [userId, `exp-${i}`, `2023-01-${j.toString().padStart(2, '0')}`, true]
            );
        }
    }

    const exps = await getExperiments(userId);

    // baseline
    const start = performance.now();
    const enriched = await Promise.all(
        exps.map(async (exp) => {
            const loggedDays = await getExperimentDays(exp.id, userId);
            return {
                ...exp,
                metric_ids: JSON.parse(exp.metric_ids),
                loggedDays,
            };
        })
    );
    const end = performance.now();
    console.log(`Baseline N+1 took ${end - start} ms`);

    // improved using actual SQL translation if possible, or IN clause
    const start2 = performance.now();

    // Using a single query to fetch all experiment days for the relevant experiments
    const experimentIds = exps.map(e => e.id);
    let allDays: any[] = [];
    if (experimentIds.length > 0) {
        // chunk logic because of SQLite variable limits is important, but for 100 it's fine.
        const placeholders = experimentIds.map(() => '?').join(',');
        const params = [userId, ...experimentIds];
        allDays = await db.all(
            `SELECT experiment_id, day, adherent FROM experiment_days WHERE user_id = ? AND experiment_id IN (${placeholders}) ORDER BY day ASC`,
            params
        );
    }

    const daysByExp = new Map<string, any[]>();
    for (const day of allDays) {
      if (!daysByExp.has(day.experiment_id)) {
        daysByExp.set(day.experiment_id, []);
      }
      daysByExp.get(day.experiment_id)!.push(day);
    }

    const enriched2 = exps.map(exp => {
      const loggedDays = daysByExp.get(exp.id) || [];
      return {
        ...exp,
        metric_ids: JSON.parse(exp.metric_ids),
        loggedDays,
      };
    });

    const end2 = performance.now();
    console.log(`Improved (with IN clause) took ${end2 - start2} ms`);
}
main();
