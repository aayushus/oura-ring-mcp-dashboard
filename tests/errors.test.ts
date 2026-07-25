import { describe, it, expect } from "vitest";
import { OuraApiError, formatError, getNoDataMessage } from "./src/utils/errors.js";

describe("errors", () => {
  it("should format OuraApiError", () => {
    const err = new OuraApiError(400, "Bad Request", "{}");
    expect(formatError(err)).toContain("Invalid request");
  });

  it("should handle 401", () => {
    const err = new OuraApiError(401, "Unauthorized", "");
    expect(formatError(err)).toContain("Authentication failed");
  });

  it("should handle 404", () => {
    const err = new OuraApiError(404, "Not Found", "");
    expect(formatError(err)).toContain("Endpoint not found");
  });

  it("should handle 426", () => {
    const err = new OuraApiError(426, "Upgrade Required", "");
    expect(formatError(err)).toContain("Subscription required");
  });

  it("should handle 429", () => {
    const err = new OuraApiError(429, "Too Many Requests", "");
    expect(formatError(err)).toContain("Rate limited");
  });

  it("should handle JSON bodies", () => {
    const err1 = new OuraApiError(400, "Bad Request", '{"detail":"some detail"}');
    expect(err1.message).toContain("some detail");
    const err2 = new OuraApiError(400, "Bad Request", '{"message":"some message"}');
    expect(err2.message).toContain("some message");
    const err3 = new OuraApiError(400, "Bad Request", '{"error":"some error"}');
    expect(err3.message).toContain("some error");
    const err4 = new OuraApiError(400, "Bad Request", '{"other":"stuff"}');
    expect(err4.message).toContain("Check your date");
  });

  it("should parse long text bodies", () => {
    const longBody = "a".repeat(300);
    const err = new OuraApiError(400, "Bad Request", longBody);
    expect(err.message).toContain("Check your date");
  });

  it("should format string errors", () => {
    expect(formatError("just a string")).toBe("An unknown error occurred");
  });

  it("should handle fetch failed errors", () => {
    expect(formatError(new Error("fetch failed"))).toContain("Network error");
    expect(formatError(new Error("ENOTFOUND"))).toContain("Network error");
    expect(formatError(new Error("ETIMEDOUT"))).toContain("Request timed out");
    expect(formatError(new Error("timeout"))).toContain("Request timed out");
  });

  it("should handle getNoDataMessage correctly for sleep with endDate", () => {
    const msg = getNoDataMessage("sleep", "2024-01-01", "2024-01-02");
    expect(msg).toContain("2024-01-01 to 2024-01-02");
    expect(msg).toContain("Sleep data appears on the day you woke up");
  });
});
