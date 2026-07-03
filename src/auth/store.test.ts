import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import * as os from 'node:os';

vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  }
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home')
}));

import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  isExpired,
  getCredentialsPath
} from './store.js';

describe('store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCredentialsPath', () => {
    it('returns the correct path based on homedir', () => {
      const path = getCredentialsPath();
      expect(path).toBe(join('/mock/home', '.oura-mcp', 'credentials.json'));
    });
  });

  describe('loadCredentials', () => {
    it('loads valid credentials', async () => {
      const mockCreds = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'bearer',
        expires_at: 1234567890
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCreds));

      const creds = await loadCredentials();
      expect(creds).toEqual(mockCreds);
      expect(fs.readFile).toHaveBeenCalledWith(getCredentialsPath(), 'utf-8');
    });

    it('returns null if required fields are missing', async () => {
      const mockCreds = {
        access_token: '', // missing
        refresh_token: 'refresh123',
        token_type: 'bearer',
        expires_at: 1234567890
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCreds));

      const creds = await loadCredentials();
      expect(creds).toBeNull();
    });

    it('returns null if file read fails', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const creds = await loadCredentials();
      expect(creds).toBeNull();
    });

    it('returns null if JSON is invalid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      const creds = await loadCredentials();
      expect(creds).toBeNull();
    });
  });

  describe('saveCredentials', () => {
    it('saves credentials and ensures directory exists', async () => {
      const mockCreds = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'bearer',
        expires_at: 1234567890
      };

      await saveCredentials(mockCreds);

      expect(fs.mkdir).toHaveBeenCalledWith(join('/mock/home', '.oura-mcp'), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        getCredentialsPath(),
        JSON.stringify(mockCreds, null, 2),
        { mode: 0o600 }
      );
    });
  });

  describe('clearCredentials', () => {
    it('deletes the credentials file', async () => {
      await clearCredentials();
      expect(fs.unlink).toHaveBeenCalledWith(getCredentialsPath());
    });

    it('ignores errors if file does not exist', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));
      // Should not throw
      await expect(clearCredentials()).resolves.not.toThrow();
    });
  });

  describe('isExpired', () => {
    it('returns true if expired or within buffer', () => {
      const now = Date.now();
      const mockCreds = {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'bearer',
        expires_at: now + 30000 // Expires in 30s
      };

      // Buffer is 60s by default, so 30s is within buffer -> expired
      expect(isExpired(mockCreds)).toBe(true);
    });

    it('returns false if not expired and outside buffer', () => {
      const now = Date.now();
      const mockCreds = {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'bearer',
        expires_at: now + 120000 // Expires in 120s
      };

      // Buffer is 60s by default, so 120s is outside buffer -> not expired
      expect(isExpired(mockCreds)).toBe(false);
    });
  });
});
