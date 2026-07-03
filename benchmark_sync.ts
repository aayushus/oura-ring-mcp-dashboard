import { syncData } from "./src/sync.js";
import { getDb } from "./src/db.js";

class MockOuraClient {
  async getDailySleep() {
    return { data: Array.from({ length: 5000 }, (_, i) => ({ day: `2023-01-${(i % 31 + 1).toString().padStart(2, '0')}`, score: 85 })) };
  }
  async getSleep() {
    return { data: Array.from({ length: 5000 }, (_, i) => ({ day: `2023-01-${(i % 31 + 1).toString().padStart(2, '0')}`, total_sleep_duration: 28800 })) };
  }
  async getDailyReadiness() {
    return { data: Array.from({ length: 5000 }, (_, i) => ({ day: `2023-01-${(i % 31 + 1).toString().padStart(2, '0')}`, score: 90, temperature_deviation: 0.1 })) };
  }
  async getDailyActivity() {
    return { data: Array.from({ length: 5000 }, (_, i) => ({ day: `2023-01-${(i % 31 + 1).toString().padStart(2, '0')}`, steps: 10000 })) };
  }
  async getDailyStress() {
    return { data: Array.from({ length: 5000 }, (_, i) => ({ day: `2023-01-${(i % 31 + 1).toString().padStart(2, '0')}`, stress_high: 3600 })) };
  }
  async getHeartRate() { return { data: [] }; }
  async getWorkouts() { return { data: [] }; }
  async getSessions() { return { data: [] }; }
  async getSleepTime() { return { data: [] }; }
  async getDailySpo2() { return { data: [] }; }
  async getVO2Max() { return { data: [] }; }
  async getDailyResilience() { return { data: [] }; }
  async getDailyCardiovascularAge() { return { data: [] }; }
  async getEnhancedTags() { return { data: [] }; }
  async getRingConfiguration() { return { data: [] }; }
  async getRestModePeriods() { return { data: [] }; }
  async getPersonalInfo() { return null; }
}

async function run() {
  await getDb(); // init db
  const client = new MockOuraClient() as any;
  const start = performance.now();
  await syncData(client, "2023-01-01", "2023-01-31");
  const end = performance.now();
  console.log(`Sync took: ${end - start}ms`);
}
run().catch(console.error);
