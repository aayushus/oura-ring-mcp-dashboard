import { describe, it, expect } from "vitest";
import { generateSessionToken } from "../src/auth/web.js";

describe("generateSessionToken", () => {
  it("should return a string", () => {
    const token = generateSessionToken();
    expect(typeof token).toBe("string");
  });

  it("should return a 64-character hex string", () => {
    const token = generateSessionToken();
    expect(token.length).toBe(64);
    expect(/^[0-9a-f]{64}$/i.test(token)).toBe(true);
  });

  it("should generate unique tokens", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(token1).not.toBe(token2);
  });
});
