import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./crypto.js";
import { getAuthSecret } from "./config.js";

describe("Crypto Utils", () => {
  beforeEach(() => {
    // Ensure tests are running with a consistent environment
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe("encrypt and decrypt", () => {
    it("should successfully encrypt and decrypt a valid string", () => {
      const plaintext = "Hello World! This is a test string.";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe("string");

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should successfully encrypt and decrypt an empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for the same plaintext due to random IV", () => {
      const plaintext = "Same String";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe("decrypt error handling", () => {
    it("should throw an error if the cipher format is too short", () => {
      // Create a string that decodes to less than 56 hex chars (28 bytes)
      const invalidCipher = Buffer.from("tooshort", "utf8").toString("base64");

      expect(() => decrypt(invalidCipher)).toThrow("Invalid cipher format");
    });

    it("should throw an error if the auth tag or ciphertext is tampered with", () => {
      const plaintext = "Secret Message";
      const encrypted = encrypt(plaintext);

      // encrypted is a base64 string
      const buffer = Buffer.from(encrypted, "base64");

      // flip a bit in the last byte (likely ciphertext or tag)
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 1;

      const tampered = buffer.toString("base64");

      expect(() => decrypt(tampered)).toThrow("Unsupported state or unable to authenticate data");
    });
  });
});
