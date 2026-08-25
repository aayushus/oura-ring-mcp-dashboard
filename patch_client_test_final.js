import fs from 'fs';
const content = fs.readFileSync('src/client.test.ts', 'utf-8');

const additionalTests = `
  describe("getHeartRate", () => {
    it("should fetch heart rate in chunks", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ bpm: 60, source: "awake" }] }),
      });
      const result = await client.getHeartRate("2024-01-01", "2024-01-10");
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle error in heart rate chunks", async () => {
      mockFetch.mockRejectedValue(new Error("Network Error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        await client.getHeartRate("2024-01-01", "2024-01-10");
      } catch (e) {
      }
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("pagination", () => {
    it("should handle autoPaginate up to maxPages", async () => {
      const responses = Array(65).fill({
        ok: true,
        json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: "token" }),
      });
      responses[64] = {
        ok: true,
        json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: null }),
      };

      let mockCount = 0;
      mockFetch.mockImplementation(() => {
        return Promise.resolve(responses[mockCount++]);
      });

      const result = await client.getSleep("2024-01-01", "2024-01-01");
      // maxPages is 60, plus the first request = 61 requests. Each gives 1 item.
      expect(result.data.length).toBe(61);
    });

    it("should skip adding next_token parameter from existing params", async () => {
      // Simulate providing a next_token in the original params (though we shouldn't normally, this tests the branch)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: "token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-02" }], next_token: null }),
        });

      // We need to call a fetch with next_token in params AND getting next_token in result.
      const tempClient = new OuraClient({ accessToken: "token" });
      await (tempClient as any).fetch("sleep", { next_token: "original_token", other_param: "value" }, true);

      const calls = mockFetch.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][0]).toContain("next_token=token"); // the one appended from result
      expect(calls[1][0]).toContain("other_param=value");
      expect(calls[1][0]).not.toContain("next_token=original_token");
    });

    it("should test params branch inside the while loop", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: "token2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-02" }], next_token: null }),
        });

      const tempClient = new OuraClient({ accessToken: "token" });
      await (tempClient as any).fetch("sleep", { start_date: "2024-01-01", end_date: "2024-01-02" }, true);

      const calls = mockFetch.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][0]).toContain("start_date=2024-01-01");
      expect(calls[1][0]).toContain("end_date=2024-01-02");
    });

    it("should test empty params branch inside the while loop", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ hardware_type: "gen3" }], next_token: "token3" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ hardware_type: "gen4" }], next_token: null }),
        });

      const tempClient = new OuraClient({ accessToken: "token" });
      await (tempClient as any).fetch("ring_configuration", undefined, true);

      const calls = mockFetch.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][0]).toContain("next_token=token3");
    });

    it("should iterate params where key === next_token", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ hardware_type: "gen3" }], next_token: "token3" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ hardware_type: "gen4" }], next_token: null }),
        });

      const tempClient = new OuraClient({ accessToken: "token" });
      await (tempClient as any).fetch("ring_configuration", { next_token: "old_token" }, true);

      const calls = mockFetch.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][0]).toContain("next_token=token3");
      expect(calls[1][0]).not.toContain("next_token=old_token");
    });

    it("should handle non-ok next page", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: "token" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Internal Server Error"),
        });

      const result = await client.getSleep("2024-01-01", "2024-01-01");
      expect(result.data).toHaveLength(1);
    });

    it("should handle pagination when next data is not an array", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ day: "2024-01-01" }], next_token: "token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: "not-an-array", next_token: null }),
        });

      const result = await client.getSleep("2024-01-01", "2024-01-01");
      expect(result.data).toHaveLength(1);
    });
  });

  describe("context override token behavior", () => {
    it("should use contextClient token if available", async () => {
      const contextModule = await import("./auth/context.js");
      vi.spyOn(contextModule, "getContextOuraClient").mockReturnValue({
        accessToken: "context-token",
        setAccessToken: () => {},
        getDailySleep: vi.fn(),
        getSleep: vi.fn(),
        getDailyActivity: vi.fn(),
        getDailyStress: vi.fn(),
        getHeartRate: vi.fn(),
        getWorkouts: vi.fn(),
        getDailySpo2: vi.fn(),
        getVO2Max: vi.fn(),
        getResilience: vi.fn(),
        getCardiovascularAge: vi.fn(),
        getTags: vi.fn(),
        getEnhancedTags: vi.fn(),
        getSessions: vi.fn(),
        getRestModePeriods: vi.fn(),
        getRingConfiguration: vi.fn(),
        getSleepTime: vi.fn(),
        getPersonalInfo: vi.fn(),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await client.getSleep("2024-01-01", "2024-01-01");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: \`Bearer context-token\`,
          },
        })
      );
    });
  });

  describe("constructor behavior", () => {
    it("should allow setting access token later", () => {
      const newClient = new OuraClient({ accessToken: "my-token" });
      newClient.setAccessToken("new-token");
    });
  });
`;

fs.writeFileSync('src/client.test.ts', content.replace(/describe\("getDailyActivity", \(\) => {/, additionalTests + '\n  describe("getDailyActivity", () => {'));
