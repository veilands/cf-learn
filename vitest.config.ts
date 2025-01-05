import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        API_KEYS: {
          my_api_key_12345: 'true'
        },
        METRICS: {},
      },
      kvNamespaces: ['API_KEYS', 'METRICS'],
      vars: {
        INFLUXDB_URL: 'https://example.influxdb.com',
        INFLUXDB_ORG: 'test-org',
        INFLUXDB_BUCKET: 'test-bucket',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
      ],
    },
  },
});
