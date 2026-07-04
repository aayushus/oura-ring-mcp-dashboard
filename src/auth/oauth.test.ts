import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  getOAuthConfigFromEnv,
} from "./oauth.js";
import { saveCredentials } from "./store.js";

// Mock the store to prevent real file operations
vi.mock("./store.js", () => ({
  saveCredentials: vi.fn().mockResolvedValue(undefined),
}));

// Provide a mock for global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OAuth module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const config = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost/callback",
  };

  describe("buildAuthorizationUrl", () => {
    it("should build URL with default ALL_SCOPES when scopes are omitted", () => {
      const state = "test-state";
      const url = buildAuthorizationUrl(config, state);

      const parsedUrl = new URL(url);
      expect(parsedUrl.origin).toBe("https://cloud.ouraring.com");
      expect(parsedUrl.pathname).toBe("/oauth/authorize");

      const params = parsedUrl.searchParams;
      expect(params.get("response_type")).toBe("code");
      expect(params.get("client_id")).toBe(config.clientId);
      expect(params.get("redirect_uri")).toBe(config.redirectUri);
      expect(params.get("state")).toBe(state);

      // Check default scopes
      const scopes = params.get("scope");
      expect(scopes).toBeDefined();
      expect(scopes?.includes("email")).toBe(true);
      expect(scopes?.includes("daily")).toBe(true);
    });

    it("should build URL with custom scopes when provided", () => {
      const state = "test-state";
      const customConfig = {
        ...config,
        scopes: ["email", "personal"],
      };
      const url = buildAuthorizationUrl(customConfig, state);

      const parsedUrl = new URL(url);
      const params = parsedUrl.searchParams;
      expect(params.get("scope")).toBe("email personal");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange code for tokens and calculate expires_at correctly", async () => {
      const mockNow = 1000000000000; // Fixed timestamp for testing
      vi.spyOn(Date, "now").mockReturnValue(mockNow);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          token_type: "bearer",
          expires_in: 86400, // 24 hours
        }),
      });

      const credentials = await exchangeCodeForTokens("test-code", config);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("https://api.ouraring.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: expect.any(URLSearchParams),
      });

      // Verify the body format
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("test-code");
      expect(body.get("client_id")).toBe(config.clientId);
      expect(body.get("client_secret")).toBe(config.clientSecret);
      expect(body.get("redirect_uri")).toBe(config.redirectUri);

      // Verify result
      expect(credentials).toEqual({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_at: mockNow + 86400 * 1000,
      });

      vi.restoreAllMocks();
    });

    it("should throw an error when token exchange fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      });

      await expect(exchangeCodeForTokens("bad-code", config)).rejects.toThrow(
        "Token exchange failed: 400 invalid_grant"
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh tokens, calculate expires_at, and save new credentials", async () => {
      const mockNow = 1000000000000;
      vi.spyOn(Date, "now").mockReturnValue(mockNow);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "bearer",
          expires_in: 86400,
        }),
      });

      const credentials = await refreshAccessToken("old-refresh-token", config);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("old-refresh-token");
      expect(body.get("client_id")).toBe(config.clientId);
      expect(body.get("client_secret")).toBe(config.clientSecret);

      const expectedCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "bearer",
        expires_at: mockNow + 86400 * 1000,
      };

      expect(credentials).toEqual(expectedCredentials);
      expect(saveCredentials).toHaveBeenCalledTimes(1);
      expect(saveCredentials).toHaveBeenCalledWith(expectedCredentials);

      vi.restoreAllMocks();
    });

    it("should throw an error when token refresh fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "invalid_client",
      });

      await expect(refreshAccessToken("bad-token", config)).rejects.toThrow(
        "Token refresh failed: 401 invalid_client"
      );

      expect(saveCredentials).not.toHaveBeenCalled();
    });
  });

  describe("revokeToken", () => {
    it("should successfully call the revoke endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await revokeToken("token-to-revoke");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ouraring.com/oauth/revoke?access_token=token-to-revoke",
        { method: "POST" }
      );
    });

    it("should throw an error when token revocation fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(revokeToken("bad-token")).rejects.toThrow(
        "Token revocation failed: 500 Internal Server Error"
      );
    });
  });

  describe("getOAuthConfigFromEnv", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return config object when required env vars are present", () => {
      process.env.OURA_CLIENT_ID = "env-client-id";
      process.env.OURA_CLIENT_SECRET = "env-client-secret";
      process.env.OURA_REDIRECT_URI = "https://example.com/callback";

      const config = getOAuthConfigFromEnv();

      expect(config).toEqual({
        clientId: "env-client-id",
        clientSecret: "env-client-secret",
        redirectUri: "https://example.com/callback",
      });
    });

    it("should fall back to localhost callback when redirect URI is not set", () => {
      process.env.OURA_CLIENT_ID = "env-client-id";
      process.env.OURA_CLIENT_SECRET = "env-client-secret";
      delete process.env.OURA_REDIRECT_URI;

      const config = getOAuthConfigFromEnv();

      expect(config).toEqual({
        clientId: "env-client-id",
        clientSecret: "env-client-secret",
        redirectUri: "http://localhost:3000/callback",
      });
    });

    it("should return null when OURA_CLIENT_ID is missing", () => {
      delete process.env.OURA_CLIENT_ID;
      process.env.OURA_CLIENT_SECRET = "env-client-secret";

      const config = getOAuthConfigFromEnv();
      expect(config).toBeNull();
    });

    it("should return null when OURA_CLIENT_SECRET is missing", () => {
      process.env.OURA_CLIENT_ID = "env-client-id";
      delete process.env.OURA_CLIENT_SECRET;

      const config = getOAuthConfigFromEnv();
      expect(config).toBeNull();
    });
  });
});
