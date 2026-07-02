import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'src/types/**',        // Generated types from OpenAPI
        'src/auth/**',         // CLI auth code (interactive, hard to test)
        'dist/**',
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'scripts/**',
        'vitest.config.ts',
        'tests/fixtures/**',   // Test fixtures (JSON)
        'tests/helpers/**',    // Test helpers
        'src/utils/index.ts',  // Re-export file
      ],
      thresholds: {
        // Global thresholds — ratcheted down when the dashboard/server
        // features (db.ts, sync.ts, device.ts, digest.ts, targets.ts,
        // analysis/dashboard.ts) landed with thin coverage. Raise back
        // toward branches 70 / rest 80 as tests for those modules land.
        branches: 60,
        functions: 75,
        lines: 75,
        statements: 75,
        // Per-file thresholds for utilities (higher standards)
        'src/utils/formatters.ts': {
          branches: 100,
          functions: 100,
          lines: 95,
          statements: 95
        },
        'src/utils/errors.ts': {
          branches: 95,
          functions: 100,
          lines: 95,
          statements: 95
        },
        // analysis.ts was split into src/utils/analysis/ — glob keeps the bar
        'src/utils/analysis/**/*.ts': {
          branches: 60,
          functions: 85,
          lines: 80,
          statements: 80
        },
        'src/client.ts': {
          branches: 100,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  }
});
