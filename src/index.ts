import { Env } from './types';
import { handleHealthRequest } from './handlers/health';
import { handleMetricsRequest } from './handlers/metrics';
import { handleTimeRequest } from './handlers/time';
import { handleMeasurementRequest } from './handlers/measurement';
import { handleBulkMeasurementRequest } from './handlers/bulkMeasurement';
import { handleVersionRequest } from './handlers/version';
import { handleCachePurgeRequest, handleCacheWarmRequest } from './handlers/cache';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { validateApiKey } from './middleware/validation';
import { withErrorHandling } from './middleware/error';
import { withSecurityHeaders } from './middleware/headers';
import { recordMetricsMiddleware } from './middleware/metrics';
import { RateLimiter } from './durable_objects/rateLimiter';
import { ErrorService } from './services/error';

export { RateLimiter };

// Apply middleware to all handlers
const withMiddleware = (handler: (request: Request, env: Env) => Promise<Response>) =>
  withErrorHandling(withSecurityHeaders(handler));

async function handleRequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    
    // Apply rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, env);
    if (rateLimitResponse) {
      return ErrorService.createRateLimitResponse(request, 60);
    }

    // Validate API key for protected endpoints
    if (url.pathname !== '/health' && url.pathname !== '/time' && url.pathname !== '/version' && url.pathname !== '/cache/purge' && url.pathname !== '/cache/warm') {
      const authError = await validateApiKey(request, env);
      if (authError) return authError;
    }

    // Route requests with middleware
    switch (url.pathname) {
      case '/health':
        return withMiddleware(handleHealthRequest)(request, env);
      case '/time':
        return withMiddleware(handleTimeRequest)(request, env);
      case '/version':
        return withMiddleware(handleVersionRequest)(request, env);
      case '/metrics':
        return withMiddleware(handleMetricsRequest)(request, env);
      case '/measurement':
        return withMiddleware(handleMeasurementRequest)(request, env);
      case '/measurements/bulk':
        return withMiddleware(handleBulkMeasurementRequest)(request, env);
      case '/cache/purge':
        return withMiddleware(handleCachePurgeRequest)(request, env);
      case '/cache/warm':
        return withMiddleware(handleCacheWarmRequest)(request, env);
      default:
        return new Response(JSON.stringify({
          error: 'Not Found',
          message: 'Endpoint not found',
          details: { path: url.pathname }
        }), {
          status: 404,
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
    }
  } catch (error) {
    return ErrorService.createErrorResponse(request, error);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await handleRequest(request, env);
    
    // Record metrics asynchronously
    ctx.waitUntil(recordMetricsMiddleware(request, response, env));
    
    return response;
  }
};