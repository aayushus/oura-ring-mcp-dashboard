import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { syncData, startSyncScheduler } from "./sync.js";
import { getDb, closeDb, getHistory } from "./db.js";
import { createMockOuraClient } from "../tests/helpers/mockOuraClient.js";
import type { OuraClient } from "./client.js";

describe("Sync Coordinator", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    await getDb();
  });

  afterEach(async () => {
    await closeDb();
    vi.restoreAllMocks();
  });

  it("should sync Oura API data and store in database successfully", async () => {
    const mockClient = createMockOuraClient();

    // Run synchronization
    const result = await syncData(
      mockClient as unknown as OuraClient,
      "2024-01-01",
      "2024-01-02"
    );

    expect(result.success).toBe(true);
    expect(result.syncedDays).toBeGreaterThan(0);

    // Verify DB contains records
    const history = await getHistory(5);
    expect(history.sleep.length).toBeGreaterThan(0);
    expect(history.readiness.length).toBeGreaterThan(0);
    expect(history.activity.length).toBeGreaterThan(0);
    expect(history.stress.length).toBeGreaterThan(0);
  });

  it("should handle partial sync failures gracefully", async () => {
    // Create client where getSleep fails
    const mockClient = createMockOuraClient({
      getSleep: vi.fn().mockRejectedValue(new Error("API Timeout")),
    });

    const result = await syncData(
      mockClient as unknown as OuraClient,
      "2024-01-01",
      "2024-01-02"
    );

    // Should fail overall since Promise.all fails if one fails
    expect(result.success).toBe(false);
    expect(result.error).toContain("API Timeout");
  });

  it("should initialize background sync job", () => {
    const mockClient = createMockOuraClient();
    
    // Spy on syncData called during backfill
    const syncSpy = vi.spyOn({ syncData }, "syncData").mockResolvedValue({
      success: true,
      syncedDays: 30,
    });

    const cronTask = startSyncScheduler(mockClient as unknown as OuraClient);

    expect(cronTask).toBeDefined();
    expect(typeof cronTask.stop).toBe("function");

    // Clean up scheduler
    cronTask.stop();
  });
});
