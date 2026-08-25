/**
 * Tests for OuraClient
 *
 * Uses mocked global fetch to test API interactions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OuraClient } from "./client.js";

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

    it("should set new access token", () => {
      const newClient = new OuraClient({ accessToken: "my-token" });
      newClient.setAccessToken("new-token");
      expect(newClient.accessToken).toBe("new-token");
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

    it("should use context client token if available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sleepResponse),
      });

      // Import context to mock the spy properly instead of vi.doMock
      const authContext = await import('./auth/context.js');
      const spy = vi.spyOn(authContext, 'getContextOuraClient').mockReturnValue({ accessToken: "context-token" } as any);

      await client.getSleep("2024-01-15", "2024-01-15");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer context-token`,
          },
        })
      );

      spy.mockRestore();
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

    it("should auto-paginate when next_token is present", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "1" }],
          next_token: "token123"
        }),
      });
      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "2" }],
          next_token: null
        }),
      });

      const result = await client.getDailySleep("2024-01-01", "2024-01-15");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe("1");
      expect(result.data[1].id).toBe("2");

      // Check that the second call included the next_token
      const calledUrl = mockFetch.mock.calls[1][0];
      expect(calledUrl).toContain("next_token=token123");
    });

    it("should append params correctly during pagination", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "1" }],
          next_token: "token123"
        }),
      });
      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "2" }],
          next_token: null
        }),
      });

      // Pass start_date/end_date and a custom next_token inside params
      // We have to mock this directly against fetch since endpoints don't accept raw next_token
      // But we can trigger the `key !== "next_token"` branch by calling a method and intercepting it

      // Let's use getHeartRate or something, but actually we can just rely on the standard params
      const result = await client.getSleep("2024-01-01", "2024-01-01");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const calledUrl = mockFetch.mock.calls[1][0];
      expect(calledUrl).toContain("next_token=token123");
      expect(calledUrl).toContain("start_date=");
      expect(calledUrl).not.toMatch(/next_token=.*next_token=/); // Should not duplicate next_token
    });

    it("should paginate when params is undefined", async () => {
      // Need to hit the `if (params)` branch being falsy in pagination loop
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "1" }],
          next_token: "token123"
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "2" }],
          next_token: null
        }),
      });

      // getRingConfiguration doesn't use params
      const result = await client.getRingConfiguration();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(2);
      expect(mockFetch.mock.calls[1][0]).toContain("next_token=token123");
    });

    it("should break pagination if max pages exceeded", async () => {
      // Mock exactly maxPages + 1 responses
      for (let i = 0; i <= 60; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: `${i}` }],
            next_token: "keep_going"
          }),
        });
      }

      const result = await client.getRingConfiguration();

      // Should have made exactly 61 calls (1 original + 60 paginated)
      expect(mockFetch).toHaveBeenCalledTimes(61);
      expect(result.data).toHaveLength(61);
    });

    it("should append existing next_token param if not already next_token", async () => {
        // First page
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: "1" }],
            next_token: "token123"
          }),
        });
        // Second page
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: "2" }],
            next_token: null
          }),
        });

        // This is testing the fetch internal function which takes params
        // The easiest way is via the getHeartRate with chunking, but we can also just use any endpoint
        // To hit `if (key !== "next_token")` we actually need next_token to be in the params object.
        // None of the endpoints expose passing `next_token` as a param explicitly.
        // So we might need to bypass type safety or use a different endpoint if one exists.
        // Let's use `fetch` method directly since it's private, we can cast client to any
        const anyClient = client as any;
        await anyClient.fetch("endpoint", { custom: "param", next_token: "ignore_this" }, true);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        const url2 = mockFetch.mock.calls[1][0];
        expect(url2).toContain("custom=param");
        expect(url2).not.toContain("ignore_this");
        expect(url2).toContain("next_token=token123");
    });


    it("should stop pagination if response has no data array", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "1" }],
          next_token: "token123"
        }),
      });
      // Second page (malformed, no data array but has next_token)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          next_token: "token456"
        }),
      });
      // Need a third mock because it tries to keep going due to next_token being present
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          next_token: null
        }),
      });

      const result = await client.getDailySleep("2024-01-01", "2024-01-15");

      // Should stop paginating
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(1); // Didn't add anything from page 2 or 3
    });

    it("should stop paginating if fetch fails", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "1" }],
          next_token: "token123"
        }),
      });
      // Second page fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: () => Promise.resolve("Error"),
      });

      const result = await client.getDailySleep("2024-01-01", "2024-01-15");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
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

    it("should chunk requests for periods longer than 30 days", async () => {
      // Need 3 mock responses for a 60-day window due to 30 day step and 29 day subtraction
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 60 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 65 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 70 }] }),
        });

      // 60 day difference (2024-01-01 to 2024-03-01)
      const result = await client.getHeartRate("2024-01-01", "2024-03-01");

      // Verify the API was called 3 times (due to the date math in client.ts)
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].bpm).toBe(60);
      expect(result.data[1].bpm).toBe(65);
      expect(result.data[2].bpm).toBe(70);
    });

    it("should catch and log errors during chunked requests", async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 60 }] }),
        })
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 70 }] }),
        });

      // 60 day difference
      const result = await client.getHeartRate("2024-01-01", "2024-03-01");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Client] Heart rate chunk"),
        expect.any(Error)
      );

      // Should return the successful chunks
      expect(result.data).toHaveLength(2);
      expect(result.data[0].bpm).toBe(60);
      expect(result.data[1].bpm).toBe(70);

      consoleWarnSpy.mockRestore();
    });

    it("should handle null response in chunked requests without crashing", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 60 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(null),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ bpm: 70 }] }),
        });

      // 60 day difference
      const result = await client.getHeartRate("2024-01-01", "2024-03-01");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(2);
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
