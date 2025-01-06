import { Env } from '../types';
import { validateHttpMethod } from '../middleware/validation';
import { validateApiKey } from '../middleware/auth';
import { withCache } from '../middleware/cache';
import { Logger } from '../services/logger';
import { MetricsService } from '../services/metrics';

async function handleMetricsRequestInternal(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  Logger.info('Processing metrics request', { 
    requestId, 
    endpoint: new URL(request.url).pathname,
    method: request.method 
  });

  try {
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) return methodError;

    const authError = await validateApiKey(request, env);
    if (authError) return authError;

    // Get metrics
    const metrics = await MetricsService.getMetrics(env);
    Logger.debug('Retrieved metrics', { requestId, metrics });

    const response = new Response(JSON.stringify(metrics, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10'
      }
    });

    Logger.debug('Sending metrics response', { 
      requestId, 
      status: response.status,
      metrics: Object.keys(metrics).length 
    });

    return response;
  } catch (error) {
    Logger.error('Metrics handler error', { requestId, error });
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics',
      requestId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}

// Apply cache middleware with 10 second TTL
export const handleMetricsRequest = withCache(handleMetricsRequestInternal, {
  cacheDuration: 10
});
