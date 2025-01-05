import { Env } from '../types';
import { Logger } from '../services/logger';
import { createErrorResponse } from './validation';

export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  id: string,
  apiKey: string
): Promise<Response | null> {
  try {
    const rateLimiterId = env.RATE_LIMITER.idFromName(apiKey);
    const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);

    const rateLimitResponse = await rateLimiter.fetch(new Request(request.url + '/increment'));
    const result = await rateLimitResponse.json();

    // Add rate limit headers to all responses
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.headers['X-RateLimit-Limit']);
    headers.set('X-RateLimit-Remaining', result.headers['X-RateLimit-Remaining']);
    headers.set('X-RateLimit-Reset', result.headers['X-RateLimit-Reset']);

    if (rateLimitResponse.status === 429) {
      Logger.warn('Rate limit exceeded', {
        requestId: id,
        apiKey,
        resetTime: result.resetTime
      });

      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Rate limit of ${result.headers['X-RateLimit-Limit']} requests per minute exceeded. Reset at ${result.resetTime}`,
        requestId: id
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(headers)
        }
      });
    }

    // Request is allowed, return null to continue processing
    return null;
  } catch (error) {
    Logger.error('Rate limit check failed', {
      requestId: id,
      apiKey,
      error
    });
    return createErrorResponse(500, id, 'Internal Server Error', 'Rate limit check failed');
  }
}
