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
        branches: 60,
        functions: 75,
        lines: 75,
        statements: 75,
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
        'src/utils/analysis/**/*.ts': {
          branches: 60,
          functions: 85,
          lines: 80,
          statements: 80
        },
        'src/client.ts': {
          branches: 65,
          functions: 90,
          lines: 65,
          statements: 65
        }
      }
    }
  }
});
