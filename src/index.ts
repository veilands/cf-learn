import { Env } from './types';
import { checkRateLimit, getRateLimitHeaders } from './middleware/rateLimiter';
import { recordMetric } from './services/metrics';
import {
  handleHealthCheck,
  handleMetrics,
  handleMeasurementRequest,
  handleTimeRequest,
  handleDateRequest,
  handleVersionRequest
} from './handlers';
import { validateApiKey, createErrorResponse } from './middleware/validation';
import Logger from './services/logger';

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const endpoint = url.pathname;

  try {
    // Health check endpoint should be accessible without API key
    if (endpoint === '/health') {
      return handleHealthCheck(request, env);
    }

    // Validate API key for all other endpoints
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return createErrorResponse(
        401,
        'Unauthorized',
        'API key required',
        requestId
      );
    }

    // Validate API key in KV
    const isValidKey = await env.API_KEYS.get(apiKey);
    if (!isValidKey) {
      return createErrorResponse(
        401,
        'Unauthorized',
        'Invalid API key',
        requestId
      );
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(env, apiKey, requestId);
    if (!rateLimit.allowed) {
      const response = createErrorResponse(
        429,
        'Too Many Requests',
        'Rate limit exceeded. Please try again later.',
        requestId
      );
      
      // Add rate limit headers
      const headers = getRateLimitHeaders(rateLimit);
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      
      return response;
    }

    // Route request to appropriate handler
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
        case '/date':
          response = await handleDateRequest(request);
          break;
        case '/version':
          response = await handleVersionRequest(request, env);
          break;
        default:
          response = createErrorResponse(
            404,
            'Not Found',
            'Endpoint not found',
            requestId
          );
      }
    } catch (error) {
      Logger.error('Handler error', {
        requestId,
        endpoint,
        method: request.method,
        error
      });
      response = createErrorResponse(
        500,
        'Internal Server Error',
        'An unexpected error occurred',
        requestId
      );
    }

    // Add rate limit headers to successful response
    const headers = getRateLimitHeaders(rateLimit);
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });

    // Record metrics
    const duration = Date.now() - start;
    await recordMetric(env, endpoint, response.status, duration);

    return response;
  } catch (error) {
    Logger.error('Request processing error', {
      requestId,
      endpoint,
      method: request.method,
      error
    });
    return createErrorResponse(
      500,
      'Internal Server Error',
      'An unexpected error occurred',
      requestId
    );
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export default worker;