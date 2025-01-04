import { Env } from './types';
import { checkRateLimit } from './middleware/rateLimiter';
import { recordMetric } from './services/metrics';
import {
  handleHealthCheck,
  handleMetrics,
  handleMeasurementRequest,
  handleTimeRequest,
  handleDateRequest,
  handleVersionRequest
} from './handlers';

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const url = new URL(request.url);
  const endpoint = url.pathname;

  // Extract API key from headers
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'API key required' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Validate API key
  const isValidKey = await env.API_KEYS.get(apiKey);
  if (!isValidKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid API key' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(env, apiKey);
  if (!rateLimit.allowed) {
    const resetTime = Math.ceil(Date.now() / 1000) + 60;
    return new Response(
      JSON.stringify({ 
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': '60'
        }
      }
    );
  }

  // Add rate limit headers to all responses
  const addRateLimitHeaders = (response: Response): Response => {
    const resetTime = Math.ceil(Date.now() / 1000) + 60;
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetTime.toString());
    return response;
  };

  try {
    let response: Response;

    switch (endpoint) {
      case '/health':
        response = await handleHealthCheck(request, env);
        break;
      case '/metrics':
        response = await handleMetrics(request, env);
        break;
      case '/measurement':
        response = await handleMeasurementRequest(request, env);
        break;
      case '/time':
        response = handleTimeRequest();
        break;
      case '/date':
        response = handleDateRequest();
        break;
      case '/version':
        response = handleVersionRequest();
        break;
      default:
        response = new Response(
          JSON.stringify({ error: 'Not Found', message: 'Endpoint not found' }),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
    }

    // Add rate limit headers and record metric
    response = addRateLimitHeaders(response);
    await recordMetric(env, endpoint, response.status, Date.now() - start);

    return response;
  } catch (error) {
    console.error('Request handler error:', error);
    const response = new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return addRateLimitHeaders(response);
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export default worker;