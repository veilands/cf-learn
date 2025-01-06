import { Env, RateLimitResult } from '../types';
import { Logger } from '../services/logger';

export async function rateLimitMiddleware(
  request: Request,
  env: Env
): Promise<Response | null> {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const url = new URL(request.url);

  // Skip rate limiting for public endpoints
  if (url.pathname === '/health' || url.pathname === '/time' || url.pathname === '/version') {
    return null;
  }

  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized', message: 'API key is required' }), {
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
    }

    const id = env.RATE_LIMITER.idFromName(apiKey);
    const rateLimiter = env.RATE_LIMITER.get(id);
    const response = await rateLimiter.fetch(request.clone());
    const result = await response.json() as RateLimitResult;

    if (!result.allowed) {
      return new Response(JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded' }), {
        status: 429,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString()
        })
      });
    }

    // Add rate limit headers to the request for downstream handlers
    const headers = new Headers(request.headers);
    headers.set('X-RateLimit-Limit', '100');
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.reset.toString());
    
    // Create a new request with the updated headers
    const newRequest = new Request(request.url, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal
    });

    return null;
  } catch (error) {
    Logger.error('Rate limit check failed', { requestId, error });
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: 'Failed to check rate limit',
      requestId
    }), {
      status: 500,
      headers: new Headers({ 'Content-Type': 'application/json' })
    });
  }
}
