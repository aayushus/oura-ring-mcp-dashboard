import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndSendDigest } from "../src/utils/digest.js";
import * as db from "../src/db.js";
import fs from "fs";

vi.mock("../src/db.js", () => ({
  getDb: vi.fn(),
  getUserProfile: vi.fn(),
  getDigestLog: vi.fn(),
  upsertDigestLog: vi.fn(),
  getHistory: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "123" }),
    })),
  },
}));

describe("Morning Digest Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do nothing if digest is already sent today", async () => {
    vi.spyOn(db, "getDigestLog").mockResolvedValue({
      date: "2026-07-02",
      channel: "Email/LocalFile",
      sent_at: "2026-07-02T13:00:00Z",
      had_data: 1,
    });

    await checkAndSendDigest();
    expect(db.getUserProfile).not.toHaveBeenCalled();
  });

  it("should delay sending if today's sleep data is missing and inside 3-hour window", async () => {
    vi.spyOn(db, "getDigestLog").mockResolvedValue(null);
    vi.spyOn(db, "getUserProfile").mockResolvedValue({
      target_wake_time: "07:00",
    } as any);

    // Mock Date to be exactly 07:45 (45 mins past wake, inside 3-hour window)
    const mockDate = new Date();
    mockDate.setHours(7, 45, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const mockDb = {
      get: vi.fn().mockResolvedValue(null), // No sleep record today
    };
    vi.spyOn(db, "getDb").mockResolvedValue(mockDb as any);

    await checkAndSendDigest();
    expect(db.getHistory).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("should catch and log errors if regular email dispatch fails", async () => {
    const originalEnv = { ...process.env };
    vi.spyOn(db, "getDigestLog").mockResolvedValue(null);
    vi.spyOn(db, "getUserProfile").mockResolvedValue({
      target_wake_time: "07:00",
    } as any);

    const mockDate = new Date();
    mockDate.setHours(8, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const mockDb = {
      get: vi.fn().mockResolvedValue({ data: "{}" }),
    };
    vi.spyOn(db, "getDb").mockResolvedValue(mockDb as any);

    vi.spyOn(db, "getHistory").mockResolvedValue({
      sleep: [{ day: mockDate.toLocaleDateString("sv-SE"), score: 85 }],
      readiness: [],
      activity: [],
    } as any);

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "password";

    const mockError = new Error("SMTP connection failed");
    const nodemailer = await import("nodemailer");
    (nodemailer.default.createTransport as any).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(mockError),
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkAndSendDigest();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Digest] Error generating daily morning digest:",
      mockError
    );

    consoleSpy.mockRestore();
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("should catch and log errors if fallback email dispatch fails", async () => {
    const originalEnv = { ...process.env };
    vi.spyOn(db, "getDigestLog").mockResolvedValue(null);
    vi.spyOn(db, "getUserProfile").mockResolvedValue({
      target_wake_time: "07:00",
    } as any);

    // Mock Date to be > 3 hours past target_wake_time
    const mockDate = new Date();
    mockDate.setHours(10, 10, 0, 0); // 10:10 AM
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const mockDb = {
      get: vi.fn().mockResolvedValue(null), // No sleep record today
    };
    vi.spyOn(db, "getDb").mockResolvedValue(mockDb as any);

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "password";

    const mockError = new Error("SMTP connection failed fallback");
    const nodemailer = await import("nodemailer");
    (nodemailer.default.createTransport as any).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(mockError),
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkAndSendDigest();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Digest] Error generating daily morning digest:",
      mockError
    );

    consoleSpy.mockRestore();
    vi.useRealTimers();
    process.env = originalEnv;
  });
});
