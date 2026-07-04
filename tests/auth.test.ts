import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import {
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSession,
  deleteSession,
  createMcpApiKey,
  listMcpApiKeys,
  revokeMcpApiKey,
  getUserIdByMcpApiKey,
  updateMcpApiKeyLastUsed,
} from "../src/auth/db.js";
import { getDb, resolveUserId } from "../src/db.js";
import { requestContextStorage } from "../src/auth/context.js";

describe("Multi-User Auth & API Key Database Operations", () => {
  beforeEach(async () => {
    // Reset/initialize SQLite in-memory database
    process.env.NODE_ENV = "test";
    const db = await getDb();
    
    // Clear tables
    await db.exec("DELETE FROM users");
    await db.exec("DELETE FROM auth_sessions");
    await db.exec("DELETE FROM mcp_api_keys");
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe("User Accounts", () => {
    it("should create and retrieve users correctly", async () => {
      const user = await createUser("Alice", "alice@example.com", "hash123", "admin");
      expect(user.id).toBeDefined();
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@example.com");
      expect(user.role).toBe("admin");

      const fetchedByEmail = await getUserByEmail("alice@example.com");
      expect(fetchedByEmail).not.toBeNull();
      expect(fetchedByEmail!.id).toBe(user.id);

      const fetchedById = await getUserById(user.id);
      expect(fetchedById).not.toBeNull();
      expect(fetchedById!.name).toBe("Alice");
    });

    it("should return null for non-existent users", async () => {
      const fetched = await getUserByEmail("unknown@example.com");
      expect(fetched).toBeNull();
    });
  });

  describe("Sessions", () => {
    it("should create, fetch, and revoke sessions", async () => {
      const user = await createUser("Bob", "bob@example.com", "hash345", "member");
      const tokenHash = "token_hash_abc";
      const expiresAt = new Date(Date.now() + 100000).toISOString();

      await createSession(tokenHash, user.id, expiresAt, "Mozilla");

      const sessionDetails = await getSession(tokenHash);
      expect(sessionDetails).not.toBeNull();
      expect(sessionDetails!.user.id).toBe(user.id);
      expect(sessionDetails!.session.user_agent).toBe("Mozilla");

      await deleteSession(tokenHash);
      const revokedDetails = await getSession(tokenHash);
      expect(revokedDetails).toBeNull();
    });
  });

  describe("MCP API Keys", () => {
    it("should manage MCP client API keys", async () => {
      const user = await createUser("Charlie", "charlie@example.com", "hash678", "member");
      const apiKeyHash = "apiKeyHashVal";
      
      await createMcpApiKey(user.id, apiKeyHash, "Claude Desktop");

      const keys = await listMcpApiKeys(user.id);
      expect(keys.length).toBe(1);
      expect(keys[0].name).toBe("Claude Desktop");

      const userId = await getUserIdByMcpApiKey(apiKeyHash);
      expect(userId).toBe(user.id);

      // Verify last used timestamp update
      const keyBefore = keys[0];
      expect(keyBefore.last_used_at).toBeNull();

      await updateMcpApiKeyLastUsed(apiKeyHash);
      const keysUpdated = await listMcpApiKeys(user.id);
      expect(keysUpdated[0].last_used_at).not.toBeNull();

      // Revoke key
      await revokeMcpApiKey(user.id, apiKeyHash);
      const keysAfter = await listMcpApiKeys(user.id);
      expect(keysAfter.length).toBe(0);
    });
  });

  describe("RequestContext & Scoped Database Scoping", () => {
    it("should fallback to context user ID in db.ts when default is used", async () => {
      // 1. Default resolveUserId falls back to 1
      expect(resolveUserId(1)).toBe(1);

      // 2. Wrap execution inside storage context
      await requestContextStorage.run({ userId: 42 }, () => {
        expect(resolveUserId(1)).toBe(42);
      });
    });
  });
});
