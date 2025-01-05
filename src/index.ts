import { Env } from './types';
import { handleHealthCheck } from './handlers/health';
import { handleMetrics } from './handlers/metrics';
import { handleMeasurementRequest } from './handlers/measurement';
import { handleTimeRequest } from './handlers/time';
import { handleVersionRequest } from './handlers/version';
import { validateApiKey, createErrorResponse } from './middleware/validation';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { recordMetric } from './services/metrics';
import { Logger } from './services/logger';

export { RateLimiter } from './durable_objects/rateLimiter';

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const endpoint = url.pathname;

  try {
    Logger.info('Request started', {
      requestId,
      method: request.method,
      endpoint,
      userAgent: request.headers.get('user-agent'),
      clientIp: request.headers.get('cf-connecting-ip')
    });

    // Extract API key
    const apiKey = request.headers.get('x-api-key');

    // Skip API key validation for health endpoint
    if (endpoint !== '/health') {
      // Validate API key
      const apiKeyError = await validateApiKey(apiKey, env, requestId);
      if (apiKeyError) {
        const duration = Date.now() - start;
        await recordMetric(env, endpoint, apiKeyError.status, duration, {
          remaining: 0,
          limit: 100,
          apiKey: apiKey || 'none'
        });
        return apiKeyError;
      }

      // Check rate limit
      const rateLimitResponse = await rateLimitMiddleware(request, env, requestId, apiKey!);
      if (rateLimitResponse) {
        const duration = Date.now() - start;
        await recordMetric(env, endpoint, rateLimitResponse.status, duration, {
          remaining: parseInt(rateLimitResponse.headers.get('X-RateLimit-Remaining') || '0'),
          limit: parseInt(rateLimitResponse.headers.get('X-RateLimit-Limit') || '100'),
          apiKey: apiKey!
        });
        return rateLimitResponse;
      }
    }

    // Route the request
    let response: Response;
    try {
      switch (endpoint) {
        case '/metrics':
          response = await handleMetrics(request, env);
          break;
        case '/measurement':
          response = await handleMeasurementRequest(request, env);
          break;
        case '/time':
          response = await handleTimeRequest(request);
          break;
        case '/version':
          response = await handleVersionRequest(request, env);
          break;
        case '/health':
          response = await handleHealthCheck(request, env);
          break;
        default:
          response = createErrorResponse(404, requestId, 'Not Found');
      }

      // Copy rate limit headers from the rate limiter middleware
      const headers = new Headers(response.headers);
      if (endpoint !== '/health' && apiKey) {
        const rateLimiter = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(apiKey));
        const rateLimitResponse = await rateLimiter.fetch(new Request(request.url + '/increment'));
        const rateLimitResult = await rateLimitResponse.json();
        
        headers.set('X-RateLimit-Limit', rateLimitResult.headers['X-RateLimit-Limit']);
        headers.set('X-RateLimit-Remaining', rateLimitResult.headers['X-RateLimit-Remaining']);
        headers.set('X-RateLimit-Reset', rateLimitResult.headers['X-RateLimit-Reset']);
      }

      // Add CORS headers for successful responses
      if (response.status >= 200 && response.status < 300) {
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
      }
      
      response = new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (error) {
      Logger.error('Handler error', {
        requestId,
        endpoint,
        method: request.method,
        error
      });
      response = createErrorResponse(500, requestId, 'Internal Server Error');
    }

    const duration = Date.now() - start;
    
    // Record metrics with rate limit info if available
    const rateLimitHeaders = response.headers;
    if (apiKey && rateLimitHeaders.has('x-ratelimit-limit')) {
      await recordMetric(env, endpoint, response.status, duration, {
        remaining: parseInt(rateLimitHeaders.get('x-ratelimit-remaining') || '0'),
        limit: parseInt(rateLimitHeaders.get('x-ratelimit-limit') || '100'),
        apiKey
      });
    } else {
      await recordMetric(env, endpoint, response.status, duration);
    }

    Logger.info('Request completed', {
      requestId,
      status: response.status,
      duration_ms: duration
    });

    return response;
  } catch (error) {
    const duration = Date.now() - start;
    Logger.error('Request failed', {
      requestId,
      endpoint,
      error,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      clientIp: request.headers.get('cf-connecting-ip')
    });
    
    await recordMetric(env, endpoint, 500, duration);
    
    return createErrorResponse(500, requestId, 'Internal Server Error');
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export default worker;