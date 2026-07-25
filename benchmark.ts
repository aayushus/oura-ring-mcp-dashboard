import { performance } from "perf_hooks";

// Mock zScorer
function zScorer(values: number[]): { z: (v: number) => number; mean: number } {
  if (values.length === 0) return { z: () => 0, mean: 0 };
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return {
    z: (v: number) => stdDev === 0 ? 0 : (v - mean) / stdDev,
    mean
  };
}

// Generate large mock data
const data = {
  readiness: Array.from({ length: 365 }).map((_, i) => ({
    day: `2023-01-${i}`, hrv: Math.random() * 100, rhr: Math.random() * 60 + 40, temperature_deviation: Math.random()
  })),
  sleep: Array.from({ length: 365 }).map((_, i) => ({
    day: `2023-01-${i}`, score: Math.random() * 100
  })),
  activity: Array.from({ length: 365 }).map((_, i) => ({
    day: `2023-01-${i}`, steps: Math.random() * 15000
  }))
};

function runAnomalyDetection() {
  if (!data || data.readiness.length < 7) return [];
  const out: Array<{
    day: string;
    tone: "good" | "bad" | "warn";
    metric: string;
    detail: string;
  }> = [];

  const hrv = zScorer(data.readiness.map((x) => x.hrv));
  const rhr = zScorer(data.readiness.map((x) => x.rhr));
  const sleepScore = zScorer(data.sleep.map((x) => x.score));
  const steps = zScorer(data.activity.map((x) => x.steps));

  for (const rec of data.readiness) {
    if (rec.hrv > 0 && hrv.z(rec.hrv) <= -1.5) {
      out.push({ day: rec.day, tone: "bad", metric: `HRV ${rec.hrv} ms`, detail: "..." });
    } else if (rec.hrv > 0 && hrv.z(rec.hrv) >= 1.5) {
      out.push({ day: rec.day, tone: "good", metric: `HRV ${rec.hrv} ms`, detail: "..." });
    }
    if (rec.rhr > 0 && rhr.z(rec.rhr) >= 1.5) {
      out.push({ day: rec.day, tone: "bad", metric: `Resting HR ${rec.rhr} bpm`, detail: "..." });
    }
    if (rec.temperature_deviation >= 0.4) {
      out.push({ day: rec.day, tone: "warn", metric: "...", detail: "..." });
    }
  }
  for (const rec of data.sleep) {
    if (rec.score > 0 && sleepScore.z(rec.score) <= -1.5) {
      out.push({ day: rec.day, tone: "bad", metric: "...", detail: "..." });
    } else if (rec.score > 0 && sleepScore.z(rec.score) >= 1.5) {
      out.push({ day: rec.day, tone: "good", metric: "...", detail: "..." });
    }
  }
  for (const rec of data.activity) {
    if (rec.steps > 0 && steps.z(rec.steps) >= 1.5) {
      out.push({ day: rec.day, tone: "good", metric: "...", detail: "..." });
    }
  }

  return out.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 8);
}

// Benchmark without memoization (running on every render for 1000 renders)
const renders = 1000;
const start = performance.now();
for (let i = 0; i < renders; i++) {
  runAnomalyDetection();
}
const end = performance.now();
const timeWithoutMemo = end - start;

console.log(`Time without useMemo for ${renders} renders: ${timeWithoutMemo.toFixed(2)}ms`);

// With memoization (runs once)
const startMemo = performance.now();
const result = runAnomalyDetection(); // runs once
for (let i = 1; i < renders; i++) {
  const cached = result; // cached result
}
const endMemo = performance.now();
const timeWithMemo = endMemo - startMemo;

console.log(`Time with useMemo for ${renders} renders: ${timeWithMemo.toFixed(2)}ms`);
console.log(`Improvement: ${(timeWithoutMemo / timeWithMemo).toFixed(2)}x`);
