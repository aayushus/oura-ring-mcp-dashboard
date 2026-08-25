import { describe, it, expect, vi } from "vitest";
import { encrypt, decrypt } from "./crypto.js";
import crypto from "node:crypto";
import * as config from "./config.js";

vi.mock("./config.js", () => ({
  getAuthSecret: vi.fn(() => "test-secret"),
}));

describe("crypto", () => {
  it("should encrypt and decrypt a string with the new KDF", () => {
    const plaintext = "Hello World!";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should decrypt legacy sha256 encrypted string", () => {
    const secret = "test-secret";
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update("Legacy Data", "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    const combined = iv.toString("hex") + tag + encrypted;
    const base64 = Buffer.from(combined, "hex").toString("base64");

    const decrypted = decrypt(base64);
    expect(decrypted).toBe("Legacy Data");
  });
});
