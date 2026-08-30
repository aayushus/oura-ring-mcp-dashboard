import { describe, it, expect } from "vitest";
import { hashSessionToken } from "../src/auth/web.js";

describe("hashSessionToken", () => {
  it("should output a string of length 64 (hex representation of sha256)", () => {
    const token = "my-secret-token";
    const hash = hashSessionToken(token);
    expect(hash).toBeTypeOf("string");
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/i.test(hash)).toBe(true);
  });

  it("should return a deterministic hash for the same input", () => {
    const token = "consistent-token";
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);
    expect(hash1).toBe(hash2);
  });

  it("should correctly hash an empty string", () => {
    const emptyHash = hashSessionToken("");
    // SHA-256 for an empty string is a known constant
    expect(emptyHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should yield different hashes for different inputs", () => {
    const hash1 = hashSessionToken("token-a");
    const hash2 = hashSessionToken("token-b");
    expect(hash1).not.toBe(hash2);
  });
});
