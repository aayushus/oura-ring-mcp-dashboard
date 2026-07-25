import { performance } from 'perf_hooks';

// Mock data
const EXPERIMENTS_COUNT = 50;
const DURATION_DAYS = 365;

const experiments = Array.from({ length: EXPERIMENTS_COUNT }).map((_, i) => {
  const loggedDays = Array.from({ length: DURATION_DAYS }).map((_, j) => {
    return { day: `2024-01-${String(j % 30 + 1).padStart(2, '0')}`, adherent: Math.random() > 0.5 ? 1 : 0 };
  });

  return {
    id: i,
    start_date: '2024-01-01',
    duration_days: DURATION_DAYS,
    loggedDays
  };
});

function benchmarkCurrent() {
  const start = performance.now();
  for (const exp of experiments) {
    const datesList: string[] = [];
    const startDate = new Date(exp.start_date + "T00:00:00Z");
    for (let i = 0; i < exp.duration_days; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      datesList.push(d.toISOString().slice(0, 10));
    }

    datesList.map((day) => {
      const logRecord = exp.loggedDays?.find((l: any) => l.day === day);
      const isAdherent = logRecord ? logRecord.adherent === 1 : false;
      const state = isAdherent ? "adherent" : logRecord ? "missed" : "pending";
    });
  }
  return performance.now() - start;
}

function benchmarkOptimized() {
  const start = performance.now();
  for (const exp of experiments) {
    const datesList: string[] = [];
    const startDate = new Date(exp.start_date + "T00:00:00Z");
    for (let i = 0; i < exp.duration_days; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      datesList.push(d.toISOString().slice(0, 10));
    }

    // Optimization
    const loggedDaysMap = new Map(exp.loggedDays?.map((l: any) => [l.day, l]) || []);

    datesList.map((day) => {
      const logRecord = loggedDaysMap.get(day);
      const isAdherent = logRecord ? logRecord.adherent === 1 : false;
      const state = isAdherent ? "adherent" : logRecord ? "missed" : "pending";
    });
  }
  return performance.now() - start;
}

const ITERATIONS = 100;

console.log("Running benchmarks...");

let currentTotal = 0;
for (let i = 0; i < ITERATIONS; i++) {
  currentTotal += benchmarkCurrent();
}

let optimizedTotal = 0;
for (let i = 0; i < ITERATIONS; i++) {
  optimizedTotal += benchmarkOptimized();
}

console.log(`Current: ${currentTotal / ITERATIONS} ms / iteration`);
console.log(`Optimized: ${optimizedTotal / ITERATIONS} ms / iteration`);
console.log(`Improvement: ${((currentTotal - optimizedTotal) / currentTotal * 100).toFixed(2)}%`);
