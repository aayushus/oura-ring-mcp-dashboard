/**
 * Thin wrapper around the Oura API v2
 * https://cloud.ouraring.com/v2/docs
 */

import type { components } from "./types/oura-api.js";
import { OuraApiError } from "./utils/errors.js";

const BASE_URL = "https://api.ouraring.com/v2/usercollection";

/**
 * Add days to a YYYY-MM-DD date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Checks if it's a single date query and expands the date range by the specified number of days.
 * WORKAROUND: Oura API returns empty results for single-date queries (start == end)
 * on many endpoints. We expand the range and filter client-side.
 */
function expandDateRangeIfSingleDate(
  startDate: string,
  endDate: string,
  expandDays: number = 1
): { isSingleDate: boolean; queryStart: string; queryEnd: string } {
  const isSingleDate = startDate === endDate;
  let queryStart = startDate;
  let queryEnd = endDate;

  if (isSingleDate) {
    queryStart = addDays(startDate, -expandDays);
    queryEnd = addDays(endDate, expandDays);
  }

  return { isSingleDate, queryStart, queryEnd };
}

// Re-export commonly used types for convenience
export type SleepSession = components["schemas"]["PublicModifiedSleepModel"];
export type DailySleep = components["schemas"]["PublicDailySleep"];
export type DailyReadiness = components["schemas"]["PublicDailyReadiness"];
export type DailyActivity = components["schemas"]["PublicDailyActivity"];
export type DailyStress = components["schemas"]["PublicDailyStress"];
export type HeartRate = components["schemas"]["PublicHeartRateRow"];
export type Workout = components["schemas"]["PublicWorkout"];
export type DailySpo2 = components["schemas"]["PublicDailySpO2"];
export type VO2Max = components["schemas"]["PublicVO2Max"];
export type PersonalInfo = components["schemas"]["PersonalInfoResponse"];
export type DailyResilience = components["schemas"]["DailyResilienceModel"];
export type DailyCardiovascularAge = components["schemas"]["PublicDailyCardiovascularAge"];
export type Tag = components["schemas"]["TagModel"];
export type EnhancedTag = components["schemas"]["EnhancedTagModel"];
export type Session = components["schemas"]["PublicSession"];
export type RestModePeriod = components["schemas"]["PublicRestModePeriod"];
export type RingConfiguration = components["schemas"]["PublicRingConfiguration"];
export type SleepTime = components["schemas"]["PublicSleepTime"];

export interface OuraClientConfig {
  accessToken: string;
}

// Generic response wrapper from Oura API
export interface OuraResponse<T> {
  data: T[];
  next_token?: string | null;
}

export class OuraClient {
  private accessToken: string;

  constructor(config: OuraClientConfig) {
    this.accessToken = config.accessToken;
  }

  /**
   * Update the access token (e.g., after OAuth flow completes)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async fetch<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new OuraApiError(response.status, response.statusText, body);
    }

    return response.json() as Promise<T>;
  }

  // ─────────────────────────────────────────────────────────────
  // Sleep endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailySleep(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailySleep>>("daily_sleep", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getSleep(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate
    );

    const response = await this.fetch<OuraResponse<SleepSession>>("sleep", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include sessions within the originally requested date range
    if (isSingleDate) {
      response.data = response.data.filter(
        (session) => session.day >= startDate && session.day <= endDate
      );
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Readiness endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailyReadiness(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailyReadiness>>("daily_readiness", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Activity endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailyActivity(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate
    );

    const response = await this.fetch<OuraResponse<DailyActivity>>("daily_activity", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include data within the originally requested date range
    if (isSingleDate) {
      response.data = response.data.filter(
        (item) => item.day >= startDate && item.day <= endDate
      );
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Stress endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailyStress(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailyStress>>("daily_stress", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Heart rate endpoints
  // ─────────────────────────────────────────────────────────────

  async getHeartRate(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<HeartRate>>("heartrate", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Workout endpoints
  // ─────────────────────────────────────────────────────────────

  async getWorkouts(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate
    );

    const response = await this.fetch<OuraResponse<Workout>>("workout", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include workouts within the originally requested date range
    if (isSingleDate) {
      response.data = response.data.filter(
        (item) => item.day >= startDate && item.day <= endDate
      );
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // SpO2 endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailySpo2(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailySpo2>>("daily_spo2", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // VO2 Max endpoints
  // ─────────────────────────────────────────────────────────────

  async getVO2Max(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<VO2Max>>("vO2_max", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Resilience endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailyResilience(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailyResilience>>("daily_resilience", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Cardiovascular age endpoints
  // ─────────────────────────────────────────────────────────────

  async getDailyCardiovascularAge(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<DailyCardiovascularAge>>("daily_cardiovascular_age", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Tag endpoints
  // ─────────────────────────────────────────────────────────────

  async getTags(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate
    );

    const response = await this.fetch<OuraResponse<Tag>>("tag", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include tags within the originally requested date range
    if (isSingleDate) {
      response.data = response.data.filter(
        (item) => item.day >= startDate && item.day <= endDate
      );
    }

    return response;
  }

  async getEnhancedTags(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate,
      3
    );

    const response = await this.fetch<OuraResponse<EnhancedTag>>("enhanced_tag", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include tags within the originally requested date range
    // EnhancedTag uses start_day instead of day
    if (isSingleDate) {
      response.data = response.data.filter(
        (item) => item.start_day >= startDate && item.start_day <= endDate
      );
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Session endpoints
  // ─────────────────────────────────────────────────────────────

  async getSessions(startDate: string, endDate: string) {
    const { isSingleDate, queryStart, queryEnd } = expandDateRangeIfSingleDate(
      startDate,
      endDate
    );

    const response = await this.fetch<OuraResponse<Session>>("session", {
      start_date: queryStart,
      end_date: queryEnd,
    });

    // Filter to only include sessions within the originally requested date range
    if (isSingleDate) {
      response.data = response.data.filter(
        (item) => item.day >= startDate && item.day <= endDate
      );
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Rest mode endpoints
  // ─────────────────────────────────────────────────────────────

  async getRestModePeriods(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<RestModePeriod>>("rest_mode_period", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Ring configuration endpoints
  // ─────────────────────────────────────────────────────────────

  async getRingConfiguration() {
    // This endpoint returns all rings without date params
    return this.fetch<OuraResponse<RingConfiguration>>("ring_configuration");
  }

  // ─────────────────────────────────────────────────────────────
  // Sleep time endpoints
  // ─────────────────────────────────────────────────────────────

  async getSleepTime(startDate: string, endDate: string) {
    return this.fetch<OuraResponse<SleepTime>>("sleep_time", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Other endpoints
  // ─────────────────────────────────────────────────────────────

  async getPersonalInfo() {
    return this.fetch<PersonalInfo>("personal_info");
  }
}
