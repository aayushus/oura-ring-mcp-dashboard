/**
 * Tests for OuraClient
 *
 * Uses mocked global fetch to test API interactions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OuraClient } from "./client.js";
import * as authContext from "./auth/context.js";

vi.mock("./auth/context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/context.js")>();
  return {
    ...actual,
    getContextOuraClient: vi.fn(),
  };
});

// Import fixture data
import sleepResponse from "../tests/fixtures/oura-sleep-response.json" with { type: "json" };
import readinessResponse from "../tests/fixtures/oura-readiness-response.json" with { type: "json" };
import activityResponse from "../tests/fixtures/oura-activity-response.json" with { type: "json" };
import stressResponse from "../tests/fixtures/oura-stress-response.json" with { type: "json" };
import dailySleepResponse from "../tests/fixtures/oura-daily-sleep-response.json" with { type: "json" };
import heartrateResponse from "../tests/fixtures/oura-heartrate-response.json" with { type: "json" };
import workoutResponse from "../tests/fixtures/oura-workout-response.json" with { type: "json" };
import spo2Response from "../tests/fixtures/oura-spo2-response.json" with { type: "json" };
import vo2maxResponse from "../tests/fixtures/oura-vo2max-response.json" with { type: "json" };
import resilienceResponse from "../tests/fixtures/oura-resilience-response.json" with { type: "json" };
import cardiovascularAgeResponse from "../tests/fixtures/oura-cardiovascular-age-response.json" with { type: "json" };
import tagsResponse from "../tests/fixtures/oura-tags-response.json" with { type: "json" };
import enhancedTagsResponse from "../tests/fixtures/oura-enhanced-tags-response.json" with { type: "json" };
import sessionsResponse from "../tests/fixtures/oura-sessions-response.json" with { type: "json" };
import restModeResponse from "../tests/fixtures/oura-rest-mode-response.json" with { type: "json" };
import ringConfigurationResponse from "../tests/fixtures/oura-ring-configuration-response.json" with { type: "json" };
import sleepTimeResponse from "../tests/fixtures/oura-sleep-time-response.json" with { type: "json" };
import personalInfoResponse from "../tests/fixtures/oura-personal-info-response.json" with { type: "json" };

const TEST_TOKEN = "test-access-token-123";
const BASE_URL = "https://api.ouraring.com/v2/usercollection";

describe("OuraClient", () => {
  let client: OuraClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new OuraClient({ accessToken: TEST_TOKEN });
    mockFetch = vi.fn();
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Constructor tests
  // ─────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should create client with access token", () => {
      const newClient = new OuraClient({ accessToken: "my-token" });
      expect(newClient).toBeInstanceOf(OuraClient);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Fetch behavior tests
  // ─────────────────────────────────────────────────────────────

  describe("fetch behavior", () => {
    it("should include Authorization header with Bearer token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      await client.getSleep("2024-01-15", "2024-01-15");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
          },
        })
      );
    });

    it("should construct correct URL with query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      await client.getSleep("2024-01-01", "2024-01-15");

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(`${BASE_URL}/sleep`);
      expect(calledUrl).toContain("start_date=2024-01-01");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });

    it("should throw error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(client.getSleep("2024-01-15", "2024-01-15")).rejects.toThrow(
        "Authentication failed: Your Oura access token is invalid or expired"
      );
    });

    it("should throw error on 500 server error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(client.getDailyReadiness("2024-01-15", "2024-01-15")).rejects.toThrow(
        "Oura API is temporarily unavailable (500)"
      );
    });

    it("should throw error on 403 forbidden", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Forbidden - insufficient scope"),
      });

      await expect(client.getDailyActivity("2024-01-15", "2024-01-15")).rejects.toThrow(
        "Access denied: Your token doesn't have permission for this data"
      );
    });

    it("should handle pagination via next_token", async () => {
      // First page with a next_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page1" }],
          next_token: "token-to-page-2",
        }),
      } as unknown as Response);

      // Second page with a next_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page2" }],
          next_token: "token-to-page-3",
        }),
      } as unknown as Response);

      // Third page, no next_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page3" }],
        }),
      } as unknown as Response);

      // We need to call a method that has pagination enabled.
      // Most endpoints have it. Let's use getSleep.
      const result = await client.getSleep("2024-01-01", "2024-01-02");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(3);
      expect((result.data[0] as any).id).toBe("page1");
      expect((result.data[1] as any).id).toBe("page2");
      expect((result.data[2] as any).id).toBe("page3");
    });

    it("should stop pagination if next request fails", async () => {
      // First page with a next_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page1" }],
          next_token: "token-to-page-2",
        }),
      } as unknown as Response);

      // Second page fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as unknown as Response);

      const result = await client.getSleep("2024-01-01", "2024-01-02");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    });

    it("should stop pagination after max pages is reached", async () => {
      mockFetch.mockImplementation(async (url) => {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: "page" }],
            next_token: "next",
          }),
        } as unknown as Response;
      });

      const result = await client.getSleep("2024-01-01", "2024-01-02");

      // Initial request + 60 pagination requests = 61 total
      expect(mockFetch).toHaveBeenCalledTimes(61);
      expect(result.data).toHaveLength(61);
    });

    it("should handle paginated endpoints that have extra params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page1" }],
          next_token: "next-token-id",
        }),
      } as unknown as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: "not an array, maybe edge case object"
        }),
      } as unknown as Response);

      const result = await client.getSleep("2024-01-01", "2024-01-02");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // The second request shouldn't add the non-array data
      expect(result.data).toHaveLength(1);

      const secondCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain("start_date=2024-01-01");
      expect(secondCallUrl).toContain("next_token=next-token-id");
    });

    it("should handle paginated endpoints with next_token in params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page1" }],
          next_token: "next-token-id",
        }),
      } as unknown as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: []
        }),
      } as unknown as Response);

      // Force a next_token in params to test exclusion logic in pagination loop
      const result = await (client as any).fetch("sleep", {
        start_date: "2024-01-01",
        next_token: "should-be-excluded",
      }, true);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const secondCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain("start_date=2024-01-01");
      expect(secondCallUrl).toContain("next_token=next-token-id");
      expect(secondCallUrl).not.toContain("next_token=should-be-excluded");
    });

    it("should handle paginated endpoints with undefined params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "page1" }],
          next_token: "next-token-id",
        }),
      } as unknown as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: []
        }),
      } as unknown as Response);

      // Pass undefined for params (e.g. some endpoints might not have params)
      const result = await (client as any).fetch("sleep", undefined, true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain("next_token=next-token-id");
    });

    it("should use context access token if available", async () => {
      // Create a mock context returning an access token
      const mockContext = { accessToken: "context-token" };
      vi.mocked(authContext.getContextOuraClient).mockReturnValue(mockContext as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      await client.getPersonalInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer context-token`,
          },
        })
      );

      vi.mocked(authContext.getContextOuraClient).mockReturnValue(undefined);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Sleep endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getSleep", () => {
    it("should fetch sleep data for date range", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      const result = await client.getSleep("2024-01-15", "2024-01-15");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should return empty data array when no sleep found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], next_token: null }),
      });

      const result = await client.getSleep("2024-01-15", "2024-01-15");

      expect(result.data).toHaveLength(0);
    });

    it("should expand single-date queries by ±1 day (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      await client.getSleep("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-14");
      expect(calledUrl).toContain("end_date=2024-01-16");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...sleepResponse.data[0], day: "2024-01-14" },
          { ...sleepResponse.data[0], day: "2024-01-15" },
          { ...sleepResponse.data[0], day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getSleep("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      await client.getSleep("2024-01-10", "2024-01-15");

      // Verify the API was called with exact dates (no expansion)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  describe("getDailySleep", () => {
    it("should fetch daily sleep scores", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(dailySleepResponse),
      });

      const result = await client.getDailySleep("2024-01-15", "2024-01-15");

      expect(result).toEqual(dailySleepResponse);
      expect(result.data[0].score).toBe(85);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Readiness endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailyReadiness", () => {
    it("should fetch readiness data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(readinessResponse),
      });

      const result = await client.getDailyReadiness("2024-01-15", "2024-01-15");

      expect(result).toEqual(readinessResponse);
      expect(result.data[0].score).toBe(82);
      expect(result.data[0].contributors.hrv_balance).toBe(78);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Activity endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailyActivity", () => {
    it("should fetch activity data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(activityResponse),
      });

      const result = await client.getDailyActivity("2024-01-15", "2024-01-15");

      expect(result.data[0].steps).toBe(8500);
      expect(result.data[0].active_calories).toBe(450);
    });

    it("should expand single-date queries by ±1 day (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(activityResponse),
      });

      await client.getDailyActivity("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-14");
      expect(calledUrl).toContain("end_date=2024-01-16");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...activityResponse.data[0], day: "2024-01-14" },
          { ...activityResponse.data[0], day: "2024-01-15" },
          { ...activityResponse.data[0], day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getDailyActivity("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(activityResponse),
      });

      await client.getDailyActivity("2024-01-10", "2024-01-15");

      // Verify the API was called with exact dates (no expansion)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Stress endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailyStress", () => {
    it("should fetch stress data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(stressResponse),
      });

      const result = await client.getDailyStress("2024-01-15", "2024-01-15");

      expect(result).toEqual(stressResponse);
      expect(result.data[0].day_summary).toBe("restored");
      expect(result.data[0].stress_high).toBe(3600);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Heart rate endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getHeartRate", () => {
    it("should fetch heart rate data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(heartrateResponse),
      });

      const result = await client.getHeartRate("2024-01-15", "2024-01-15");

      expect(result).toEqual(heartrateResponse);
      expect(result.data).toHaveLength(6);
      expect(result.data[0].bpm).toBe(55);
      expect(result.data[0].source).toBe("sleep");
    });

    it("should chunk requests for heart rate data over 30 days", async () => {
      // It requests in chunks of 30 days backwards from the end date up to maxChunks (4).
      // If we ask for 45 days, it should make 2 requests.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ bpm: 60 }] }),
      } as unknown as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ bpm: 65 }] }),
      } as unknown as Response);

      // Start: 2024-01-01, End: 2024-02-15 (45 days)
      const result = await client.getHeartRate("2024-01-01", "2024-02-15");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].bpm).toBe(60);
      expect(result.data[1].bpm).toBe(65);
    });

    it("should handle errors in heart rate chunking", async () => {
      // First chunk succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ bpm: 60 }] }),
      } as unknown as Response);

      // Second chunk fails, but should not crash the whole process
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as unknown as Response);

      // We'll mock console.warn to avoid noisy test output
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Start: 2024-01-01, End: 2024-02-15 (45 days)
      const result = await client.getHeartRate("2024-01-01", "2024-02-15");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].bpm).toBe(60);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should handle missing data array in heart rate chunking", async () => {
      // Return response without data array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Missing 'data' property
      } as unknown as Response);

      const result = await client.getHeartRate("2024-01-15", "2024-01-15");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result?.data).toBeUndefined(); // getHeartRate returns the exact response object, so if it's {} it returns { data: [] } because of chunking logic return { data: allSamples }
      // Actually chunking logic returns { data: allSamples } so it should have length 0. Let's see why result.data is null/undefined.
      // Ah, the first branch `if (diffDays <= 30)` returns the exact response. So if response is {}, result is {}.
      // If we ask for 45 days, it goes to chunking logic and returns { data: [] }. Let's test the chunking logic instead.
    });

    it("should handle missing data array in heart rate chunking (diffDays > 30)", async () => {
      // Return response without data array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Missing 'data' property
      } as unknown as Response);

      // We'll mock console.warn to avoid noisy test output
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await client.getHeartRate("2024-01-01", "2024-02-15");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(0);
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Workout endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getWorkouts", () => {
    it("should fetch workout data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workoutResponse),
      });

      const result = await client.getWorkouts("2024-01-15", "2024-01-15");

      expect(result.data[0].activity).toBe("running");
      expect(result.data[0].calories).toBe(350);
    });

    it("should expand single-date queries by ±1 day (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workoutResponse),
      });

      await client.getWorkouts("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-14");
      expect(calledUrl).toContain("end_date=2024-01-16");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...workoutResponse.data[0], day: "2024-01-14" },
          { ...workoutResponse.data[0], day: "2024-01-15" },
          { ...workoutResponse.data[0], day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getWorkouts("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workoutResponse),
      });

      await client.getWorkouts("2024-01-10", "2024-01-15");

      // Verify the API was called with exact dates (no expansion)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SpO2 endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailySpo2", () => {
    it("should fetch SpO2 data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(spo2Response),
      });

      const result = await client.getDailySpo2("2024-01-15", "2024-01-15");

      expect(result).toEqual(spo2Response);
      expect(result.data[0].spo2_percentage?.average).toBe(97.5);
      expect(result.data[0].breathing_disturbance_index).toBe(3.2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // VO2 Max endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getVO2Max", () => {
    it("should fetch VO2 max data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(vo2maxResponse),
      });

      const result = await client.getVO2Max("2024-01-15", "2024-01-15");

      expect(result).toEqual(vo2maxResponse);
      expect(result.data[0].vo2_max).toBe(42.5);
    });

    it("should call correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(vo2maxResponse),
      });

      await client.getVO2Max("2024-01-15", "2024-01-15");

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(`${BASE_URL}/vO2_max`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Resilience endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailyResilience", () => {
    it("should fetch resilience data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resilienceResponse),
      });

      const result = await client.getDailyResilience("2024-01-15", "2024-01-15");

      expect(result).toEqual(resilienceResponse);
      expect(result.data[0].level).toBe("solid");
      expect(result.data[0].contributors.sleep_recovery).toBe(85);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Cardiovascular age endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getDailyCardiovascularAge", () => {
    it("should fetch cardiovascular age data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(cardiovascularAgeResponse),
      });

      const result = await client.getDailyCardiovascularAge("2024-01-15", "2024-01-15");

      expect(result).toEqual(cardiovascularAgeResponse);
      expect(result.data[0].vascular_age).toBe(35);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tags endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getTags", () => {
    it("should fetch tags data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tagsResponse),
      });

      const result = await client.getTags("2024-01-15", "2024-01-15");

      expect(result.data[0].text).toBe("Had coffee after 2pm");
      expect(result.data[0].tags).toContain("caffeine");
    });

    it("should expand single-date queries by ±1 day (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tagsResponse),
      });

      await client.getTags("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-14");
      expect(calledUrl).toContain("end_date=2024-01-16");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...tagsResponse.data[0], day: "2024-01-14" },
          { ...tagsResponse.data[0], day: "2024-01-15" },
          { ...tagsResponse.data[0], day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getTags("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tagsResponse),
      });

      await client.getTags("2024-01-10", "2024-01-15");

      // Verify the API was called with original date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  describe("setAccessToken", () => {
    it("should update the access token", () => {
      const client = new OuraClient("old-token");
      client.setAccessToken("new-token");
      // Test the token works by mocking fetch and inspecting headers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      client.getPersonalInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ouraring.com/v2/usercollection/personal_info",
        expect.objectContaining({
          headers: { Authorization: "Bearer new-token" },
        })
      );
    });
  });

  describe("getEnhancedTags", () => {
    it("should fetch enhanced tags data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(enhancedTagsResponse),
      });

      const result = await client.getEnhancedTags("2024-01-15", "2024-01-15");

      expect(result.data[0].tag_type_code).toBe("tag_sleep_aid");
      expect(result.data[1].custom_name).toBe("Caffeine");
    });

    it("should expand single-date queries by ±3 days (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(enhancedTagsResponse),
      });

      await client.getEnhancedTags("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range (±3 days for enhanced_tag)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-12");
      expect(calledUrl).toContain("end_date=2024-01-18");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...enhancedTagsResponse.data[0], start_day: "2024-01-14" },
          { ...enhancedTagsResponse.data[0], start_day: "2024-01-15" },
          { ...enhancedTagsResponse.data[0], start_day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getEnhancedTags("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].start_day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(enhancedTagsResponse),
      });

      await client.getEnhancedTags("2024-01-10", "2024-01-15");

      // Verify the API was called with original date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Sessions endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getSessions", () => {
    it("should fetch sessions data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sessionsResponse),
      });

      const result = await client.getSessions("2024-01-15", "2024-01-15");

      expect(result.data[0].type).toBe("meditation");
      expect(result.data[0].mood).toBe("good");
    });

    it("should expand single-date queries by ±1 day (API workaround)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sessionsResponse),
      });

      await client.getSessions("2024-01-15", "2024-01-15");

      // Verify the API was called with expanded date range
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-14");
      expect(calledUrl).toContain("end_date=2024-01-16");
    });

    it("should filter results to only include requested date", async () => {
      // API returns data for multiple days
      const multiDayResponse = {
        data: [
          { ...sessionsResponse.data[0], day: "2024-01-14" },
          { ...sessionsResponse.data[0], day: "2024-01-15" },
          { ...sessionsResponse.data[0], day: "2024-01-16" },
        ],
        next_token: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiDayResponse),
      });

      const result = await client.getSessions("2024-01-15", "2024-01-15");

      // Should only return the requested date
      expect(result.data).toHaveLength(1);
      expect(result.data[0].day).toBe("2024-01-15");
    });

    it("should NOT expand multi-day range queries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sessionsResponse),
      });

      await client.getSessions("2024-01-10", "2024-01-15");

      // Verify the API was called with exact dates (no expansion)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("start_date=2024-01-10");
      expect(calledUrl).toContain("end_date=2024-01-15");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Rest mode endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getRestModePeriods", () => {
    it("should fetch rest mode periods", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(restModeResponse),
      });

      const result = await client.getRestModePeriods("2024-01-15", "2024-01-15");

      expect(result.data[0].start_day).toBe("2024-01-15");
      expect(result.data[0].episodes).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Ring configuration endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getRingConfiguration", () => {
    it("should fetch ring configuration without date params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(ringConfigurationResponse),
      });

      const result = await client.getRingConfiguration();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].hardware_type).toBe("gen3");
      expect(result.data[1].hardware_type).toBe("gen4");
    });

    it("should call ring_configuration endpoint without date params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(ringConfigurationResponse),
      });

      await client.getRingConfiguration();

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toBe(`${BASE_URL}/ring_configuration`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Sleep time endpoints
  // ─────────────────────────────────────────────────────────────

  describe("getSleepTime", () => {
    it("should fetch sleep time recommendations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepTimeResponse),
      });

      const result = await client.getSleepTime("2024-01-15", "2024-01-15");

      expect(result.data[0].day).toBe("2024-01-15");
      expect(result.data[0].recommendation).toBe("follow_optimal_bedtime");
      expect(result.data[0].status).toBe("optimal_found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Personal info endpoint
  // ─────────────────────────────────────────────────────────────

  describe("getPersonalInfo", () => {
    it("should fetch personal info without date params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(personalInfoResponse),
      });

      const result = await client.getPersonalInfo();

      expect(result).toEqual(personalInfoResponse);
      expect(result.email).toBe("test@example.com");
    });

    it("should call personal_info endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(personalInfoResponse),
      });

      await client.getPersonalInfo();

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toBe(`${BASE_URL}/personal_info`);
    });
  });
});
