import { describe, it, expect } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Metrics Integration', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should return metrics with valid API key', async () => {
    const resp = await worker.fetch('https://example.com/metrics', {
      headers: {
        'x-api-key': 'my_api_key_12345'
      }
    });
    
    expect(resp.status).toBe(200);
    const data = await resp.json();
    
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('status');
    expect(data.status).toHaveProperty('influxdb');
    expect(data.status).toHaveProperty('kv_store');
  });

  it('should reject requests without API key', async () => {
    const resp = await worker.fetch('https://example.com/metrics');
    expect(resp.status).toBe(401);
  });

  it('should include rate limit headers', async () => {
    const resp = await worker.fetch('https://example.com/metrics', {
      headers: {
        'x-api-key': 'my_api_key_12345'
      }
    });
    
    expect(resp.headers.get('x-ratelimit-limit')).toBe('100');
    expect(resp.headers.get('x-ratelimit-remaining')).toBeDefined();
    expect(resp.headers.get('x-ratelimit-reset')).toBeDefined();
  });
});
