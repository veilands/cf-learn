import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 10000, // 10 seconds timeout for network requests
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/tests/**',
        'dist/**',
        '.wrangler/**',
        'scripts/**',
        'vitest.config.ts',
        'coverage/**',
        '**/*.d.ts',
        '**/types.ts',
        '**/index.ts',
        '**/version.json'
      ],
      include: [
        'src/handlers/*.ts',
        'src/middleware/*.ts',
        'src/services/*.ts'
      ],
      all: false,
      clean: true,
      cleanOnRerun: true,
      reportsDirectory: './coverage',
      skipFull: false,
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    },
  },
});
