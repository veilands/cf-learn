import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../durable_objects/rateLimiter';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Logger } from '../services/logger';

// Mock DurableObjectState
class MockDurableObjectState {
  private storageMap: Map<string, any>;

  constructor() {
    this.storageMap = new Map();
  }

  get storage() {
    return {
      get: async (key: string) => this.storageMap.get(key),
      put: async (key: string, value: any) => this.storageMap.set(key, value),
      delete: async (key: string) => this.storageMap.delete(key)
    };
  }
}

// Mock Env
const mockEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => {
      const state = new MockDurableObjectState();
      const limiter = new RateLimiter(state as any, {} as any);
      return {
        fetch: async (request: Request) => limiter.fetch(request)
      };
    }
  }
} as any;

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-05T20:31:47+02:00'));
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RateLimiter Durable Object', () => {
    let state: MockDurableObjectState;
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      state = new MockDurableObjectState();
      rateLimiter = new RateLimiter(state as any, {} as any);
    });

    it('should allow requests within limit', async () => {
      const response = await rateLimiter.fetch(new Request('http://localhost/increment'));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should block requests over limit', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await rateLimiter.fetch(new Request('http://localhost/increment'));
      }

      // 101st request should be blocked
      const response = await rateLimiter.fetch(new Request('http://localhost/increment'));
      const result = await response.json();

      expect(response.status).toBe(429);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should reset counter after window expires', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await rateLimiter.fetch(new Request('http://localhost/increment'));
      }

      // Mock time passing
      vi.advanceTimersByTime(60000);
      vi.setSystemTime(new Date('2025-01-05T20:32:47+02:00'));

      // Create a fresh instance with the new time
      state = new MockDurableObjectState();
      rateLimiter = new RateLimiter(state as any, {} as any);

      // Next request should be allowed
      const response = await rateLimiter.fetch(new Request('http://localhost/increment'));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  describe('Rate Limit Middleware', () => {
    let env: any;
    let mockRateLimiter: any;

    beforeEach(() => {
      mockRateLimiter = {
        fetch: vi.fn()
      };

      env = {
        RATE_LIMITER: {
          idFromName: () => 'test-id',
          get: () => mockRateLimiter
        }
      };
    });

    it('should allow valid requests', async () => {
      mockRateLimiter.fetch.mockResolvedValue(new Response(JSON.stringify({
        allowed: true,
        remaining: 99,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': '1609459200'
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }));

      const response = await rateLimitMiddleware(
        new Request('http://localhost'),
        env,
        'test-id',
        'test-api-key'
      );

      expect(response).toBeNull(); // Null means request is allowed
    });

    it('should block rate limited requests', async () => {
      for (let i = 0; i <= 100; i++) {
        if (i < 100) {
          mockRateLimiter.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
            allowed: true,
            remaining: 100 - i,
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': (100 - i).toString(),
              'X-RateLimit-Reset': '1609459200'
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }));
        } else {
          mockRateLimiter.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Rate limit of 100 requests per minute exceeded',
            resetTime: new Date(1609459200000).toISOString(),
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': '1609459200'
            }
          }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': '1609459200'
            }
          }));
        }

        const response = await rateLimitMiddleware(
          new Request('http://localhost'),
          env,
          'test-id',
          'test-api-key'
        );

        if (i < 100) {
          expect(response).toBeNull();
        } else {
          expect(response?.status).toBe(429);
          const body = await response?.json();
          expect(body.error).toBe('Rate limit exceeded');
        }
      }
    });

    it('should add rate limit headers', async () => {
      // First request is allowed
      mockRateLimiter.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
        allowed: true,
        remaining: 99,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': '1609459200'
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': '1609459200'
        }
      }));

      // First request should be allowed
      const firstResponse = await rateLimitMiddleware(
        new Request('http://localhost'),
        env,
        'test-id',
        'test-api-key'
      );
      expect(firstResponse).toBeNull();

      // Make a request that will be rate limited
      mockRateLimiter.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Rate limit of 100 requests per minute exceeded',
        resetTime: new Date(1609459200000).toISOString(),
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1609459200'
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1609459200'
        }
      }));

      const limitedResponse = await rateLimitMiddleware(
        new Request('http://localhost'),
        env,
        'test-id',
        'test-api-key'
      );

      expect(limitedResponse?.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(limitedResponse?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(limitedResponse?.headers.get('X-RateLimit-Reset')).toBe('1609459200');
    });

    it('should handle errors gracefully', async () => {
      mockRateLimiter.fetch.mockRejectedValue(new Error('Test error'));

      const response = await rateLimitMiddleware(
        new Request('http://localhost'),
        env,
        'test-id',
        'test-api-key'
      );

      expect(response?.status).toBe(500);
      const body = await response?.json();
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toBe('Rate limit check failed');
    });
  });
});
