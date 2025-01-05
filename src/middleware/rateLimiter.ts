import { Env } from '../types';
import Logger from '../services/logger';

export interface RateLimitConfig {
  windowSize: number;  // in seconds
  maxRequests: number; // requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;      // timestamp when the limit resets
  limit: number;      // max requests allowed
  retryAfter?: number; // seconds until retry is allowed (only when rate limited)
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowSize: 60,  // 1 minute
  maxRequests: 100 // 100 requests per minute
};

async function getRateLimitConfig(env: Env, apiKey: string): Promise<RateLimitConfig> {
  try {
    const configKey = `ratelimit:config:${apiKey}`;
    const configStr = await env.METRICS.get(configKey);
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (error) {
    Logger.warn('Failed to get rate limit config', {
      error,
      data: { apiKey }
    });
  }
  return DEFAULT_RATE_LIMIT;
}

export async function checkRateLimit(
  env: Env,
  apiKey: string,
  requestId: string
): Promise<RateLimitResult> {
  const start = Date.now();
  const endpoint = 'rate-limiter';

  try {
    Logger.debug('Checking rate limit', {
      requestId,
      endpoint,
      data: { apiKey }
    });

    // Get rate limit config for this API key
    const config = await getRateLimitConfig(env, apiKey);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.windowSize;
    
    // Calculate current and previous window keys
    const currentWindow = Math.floor(now / config.windowSize);
    const key = `ratelimit:${apiKey}:${currentWindow}`;
    const previousKey = `ratelimit:${apiKey}:${currentWindow - 1}`;

    // Get current and previous window counts
    const [currentCount, previousCount] = await Promise.all([
      env.METRICS.get(key),
      env.METRICS.get(previousKey)
    ]);

    Logger.debug('Rate limit counts retrieved', {
      requestId,
      endpoint,
      data: {
        currentCount,
        previousCount,
        currentWindow,
        previousWindow: currentWindow - 1
      }
    });

    // Calculate weighted request count
    const previousWeight = (windowStart % config.windowSize) / config.windowSize;
    const weightedPreviousCount = Math.floor(parseInt(previousCount || '0') * previousWeight);
    const currentWindowCount = parseInt(currentCount || '0');
    const totalCount = currentWindowCount + weightedPreviousCount;

    // Calculate time until reset
    const resetTime = (currentWindow + 1) * config.windowSize;
    const timeUntilReset = resetTime - now;

    if (totalCount >= config.maxRequests) {
      const duration = Date.now() - start;
      Logger.warn('Rate limit exceeded', {
        requestId,
        endpoint,
        data: {
          apiKey,
          totalCount,
          currentWindowCount,
          weightedPreviousCount,
          limit: config.maxRequests,
          duration_ms: duration
        }
      });

      return {
        allowed: false,
        remaining: 0,
        reset: resetTime,
        limit: config.maxRequests,
        retryAfter: timeUntilReset
      };
    }

    // Increment current window counter
    await env.METRICS.put(key, (currentWindowCount + 1).toString(), {
      expirationTtl: config.windowSize * 2 // Keep for 2 windows
    });

    const remaining = config.maxRequests - totalCount - 1;
    const duration = Date.now() - start;
    
    Logger.debug('Rate limit check completed', {
      requestId,
      endpoint,
      data: {
        apiKey,
        allowed: true,
        remaining,
        totalCount: totalCount + 1,
        duration_ms: duration
      }
    });

    return {
      allowed: true,
      remaining,
      reset: resetTime,
      limit: config.maxRequests
    };
  } catch (error) {
    const duration = Date.now() - start;
    Logger.error('Rate limit check failed', {
      requestId,
      endpoint,
      error,
      data: {
        apiKey,
        duration_ms: duration
      }
    });

    // If rate limiting fails, allow the request but log the error
    return {
      allowed: true,
      remaining: -1,
      reset: Math.floor(Date.now() / 1000) + DEFAULT_RATE_LIMIT.windowSize,
      limit: DEFAULT_RATE_LIMIT.maxRequests
    };
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());
  
  if (!result.allowed && result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
  
  return headers;
}
