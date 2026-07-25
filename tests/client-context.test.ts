import { describe, it, expect, vi } from "vitest";
import { OuraClient } from "./src/client.js";
import { requestContextStorage } from "./src/auth/context.js";

describe("OuraClient context overrides", () => {
  it("should use contextClient token if available", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    const baseClient = new OuraClient({ accessToken: "base-token" });
    const contextClient = new OuraClient({ accessToken: "context-token" });

    await requestContextStorage.run({ userId: 1, ouraClient: contextClient }, async () => {
      await baseClient.getDailyReadiness("2024-01-01", "2024-01-02");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer context-token" },
      })
    );

    vi.restoreAllMocks();
  });
});
