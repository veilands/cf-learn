import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 10000, // 10 seconds timeout for network requests
    coverage: {
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
      ],
      include: [
        'src/handlers/**',
        'src/middleware/**',
        'src/services/**'
      ],
      all: true,
      clean: true,
      cleanOnRerun: true,
      reportsDirectory: './coverage',
      skipFull: false,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    },
  },
});
