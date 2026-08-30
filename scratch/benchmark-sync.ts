import { performance } from "perf_hooks";

// Mocking dependencies to test the loop directly
const connections = Array(50).fill(0).map((_, i) => ({ user_id: `user_${i}`, access_token: "mock" }));

async function syncUserConnectionMock(conn: any) {
  // Simulate network delay and processing time
  return new Promise(resolve => setTimeout(resolve, 50));
}

async function runSequential() {
  const start = performance.now();
  for (const conn of connections) {
    await syncUserConnectionMock(conn);
  }
  const end = performance.now();
  return end - start;
}

async function runConcurrent() {
  const start = performance.now();
  await Promise.allSettled(connections.map(conn => syncUserConnectionMock(conn)));
  const end = performance.now();
  return end - start;
}

async function main() {
  console.log("Running sequential sync...");
  const seqTime = await runSequential();
  console.log(`Sequential took: ${seqTime.toFixed(2)}ms`);

  console.log("Running concurrent sync...");
  const concTime = await runConcurrent();
  console.log(`Concurrent took: ${concTime.toFixed(2)}ms`);

  console.log(`Improvement: ${(seqTime / concTime).toFixed(2)}x faster`);
}

main();
