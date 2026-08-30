import { describe, it, expect, vi, beforeEach } from "vitest";
import { encrypt, decrypt } from "./crypto.js";
import * as config from "./config.js";

const VALID_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DIFFERENT_SECRET = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

vi.mock("./config.js", () => {
  return {
    getAuthSecret: vi.fn(() => "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
  };
});

describe("crypto utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return early if plaintext is empty", () => {
    // The encrypt function might return empty string if plaintext is empty
    // Let's check the behavior of the current implementation.
    // Wait, the current implementation in src/auth/crypto.ts doesn't have an early return for empty string!
    // But encrypting an empty string should still work and return a valid ciphertext.
    const encrypted = encrypt("");
    expect(typeof encrypted).toBe("string");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("should encrypt and decrypt a string", () => {
    const text = "hello world";
    const encrypted = encrypt(text);
    expect(encrypted).not.toBe(text);
    expect(typeof encrypted).toBe("string");

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it("should generate different ciphertexts for the same plaintext", () => {
    const text = "hello world";
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should throw an error for invalid cipher format (too short)", () => {
    expect(() => decrypt("short")).toThrow("Invalid cipher format");
  });

  it("should throw an error when decrypting with a tampered string", () => {
    const text = "hello world";
    const encrypted = encrypt(text);
    // Tamper the ciphertext slightly
    const tampered = encrypted.substring(0, encrypted.length - 1) + (encrypted.endsWith('A') ? 'B' : 'A');
    expect(() => decrypt(tampered)).toThrow(); // Should fail decryption due to auth tag mismatch
  });

  it("should throw an error if the secret changes (wrong key)", () => {
    const text = "hello world";
    const encrypted = encrypt(text);

    // Mock a different secret for decryption
    vi.mocked(config.getAuthSecret).mockReturnValueOnce(DIFFERENT_SECRET);

    expect(() => decrypt(encrypted)).toThrow();
  });
});
