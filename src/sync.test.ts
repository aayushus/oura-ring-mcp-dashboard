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

    // One failing endpoint no longer aborts the run — it becomes "partial"
    expect(result.success).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.error).toContain("API Timeout");
    const sleepEndpoint = result.endpoints.find((e) => e.key === "sleep");
    expect(sleepEndpoint?.status).toBe("error");
    expect(sleepEndpoint?.error).toContain("API Timeout");
    // Other endpoints still landed
    expect(result.endpoints.filter((e) => e.status === "done").length).toBeGreaterThan(0);
  });

  it("should report new vs already-known days", async () => {
    const mockClient = createMockOuraClient();

    const first = await syncData(
      mockClient as unknown as OuraClient,
      "2024-01-01",
      "2024-01-02"
    );
    expect(first.status).toBe("success");
    expect(first.newDays).toBe(first.syncedDays); // empty DB: everything is new

    const second = await syncData(
      mockClient as unknown as OuraClient,
      "2024-01-01",
      "2024-01-02"
    );
    expect(second.newDays).toBe(0); // same range again: nothing new
    expect(second.syncedDays).toBe(first.syncedDays);
  });

  it("should initialize background sync job", () => {
    const mockClient = createMockOuraClient();

    // Spy on syncData called during backfill
    const syncSpy = vi.spyOn({ syncData }, "syncData").mockResolvedValue({
      success: true,
      status: "success",
      syncedDays: 30,
      newDays: 0,
      totalRecords: 0,
      endpoints: [],
    });

    const cronTask = startSyncScheduler(mockClient as unknown as OuraClient);

    expect(cronTask).toBeDefined();
    expect(typeof cronTask.stop).toBe("function");

    // Clean up scheduler
    cronTask.stop();
  });
});
