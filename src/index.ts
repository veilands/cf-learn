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
import { MetricsCounter } from './durable_objects/metricsCounter';
import { ErrorService } from './services/error';

export { RateLimiter };
export { MetricsCounter };

// Apply middleware to all handlers
const withMiddleware = (handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>) =>
  withErrorHandling(withSecurityHeaders(recordMetricsMiddleware(handler)));

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    
    // Add ExecutionContext to env
    env.ctx = ctx;
    
    // Skip auth and rate limiting for public endpoints
    if (!['/health', '/time', '/version', '/cache/purge', '/cache/warm'].includes(url.pathname)) {
      // Validate API key first
      const authError = await validateApiKey(request, env);
      if (authError) return authError;

      // Then apply rate limiting
      const rateLimitResponse = await rateLimitMiddleware(request, env);
      if (rateLimitResponse) {
        return ErrorService.createRateLimitResponse(request, 60);
      }
    }

    // Route requests with middleware
    switch (url.pathname) {
      case '/health':
        return withMiddleware(handleHealthRequest)(request, env, ctx);
      case '/time':
        return withMiddleware(handleTimeRequest)(request, env, ctx);
      case '/version':
        return withMiddleware(handleVersionRequest)(request, env, ctx);
      case '/metrics':
        return withMiddleware(handleMetricsRequest)(request, env, ctx);
      case '/measurement':
        return withMiddleware(handleMeasurementRequest)(request, env, ctx);
      case '/measurements/bulk':
        return withMiddleware(handleBulkMeasurementRequest)(request, env, ctx);
      case '/cache/purge':
        return withMiddleware(handleCachePurgeRequest)(request, env, ctx);
      case '/cache/warm':
        return withMiddleware(handleCacheWarmRequest)(request, env, ctx);
      default:
        return new Response(JSON.stringify({
          error: 'Not Found',
          message: 'Endpoint not found',
          details: { path: url.pathname }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return ErrorService.createErrorResponse(request, error);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  }
};