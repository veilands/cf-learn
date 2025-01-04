import { Env } from '../types';
import Logger from '../services/logger';

export const RATE_LIMIT = {
  WINDOW_SIZE: 60, // 1 minute
  MAX_REQUESTS: 100 // 100 requests per minute
};

export async function checkRateLimit(env: Env, apiKey: string): Promise<{ allowed: boolean; remaining: number }> {
  const requestId = crypto.randomUUID();
  
  try {
    Logger.debug('Checking rate limit', { requestId, apiKey });
    
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - RATE_LIMIT.WINDOW_SIZE;
    const key = `ratelimit:${apiKey}:${Math.floor(now / RATE_LIMIT.WINDOW_SIZE)}`;
    const previousKey = `ratelimit:${apiKey}:${Math.floor(windowStart / RATE_LIMIT.WINDOW_SIZE)}`;

    // Get current and previous window counts
    const [currentCount, previousCount] = await Promise.all([
      env.METRICS.get(key),
      env.METRICS.get(previousKey)
    ]);

    Logger.debug('Rate limit counts retrieved', {
      requestId,
      currentCount,
      previousCount,
      currentKey: key,
      previousKey
    });

    // Calculate weighted count from previous window
    const previousWeight = (windowStart % RATE_LIMIT.WINDOW_SIZE) / RATE_LIMIT.WINDOW_SIZE;
    const weightedPreviousCount = Math.floor(parseInt(previousCount || '0') * previousWeight);
    const currentWindowCount = parseInt(currentCount || '0');
    const totalCount = currentWindowCount + weightedPreviousCount;

    if (totalCount >= RATE_LIMIT.MAX_REQUESTS) {
      Logger.warn('Rate limit exceeded', {
        requestId,
        apiKey,
        totalCount,
        currentWindowCount,
        weightedPreviousCount,
        limit: RATE_LIMIT.MAX_REQUESTS
      });

      return { allowed: false, remaining: 0 };
    }

    // Increment current window counter
    await env.METRICS.put(key, (currentWindowCount + 1).toString(), {
      expirationTtl: RATE_LIMIT.WINDOW_SIZE * 2 // Keep for 2 windows
    });

    const remaining = RATE_LIMIT.MAX_REQUESTS - totalCount - 1;
    
    Logger.debug('Rate limit check completed', {
      requestId,
      apiKey,
      allowed: true,
      remaining,
      totalCount: totalCount + 1
    });

    return {
      allowed: true,
      remaining
    };
  } catch (error) {
    Logger.error('Rate limit check failed', error as Error, {
      requestId,
      apiKey
    });

    // If rate limiting fails, allow the request but log the error
    return { allowed: true, remaining: -1 };
  }
}
