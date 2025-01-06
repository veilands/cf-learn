import { Env } from '../types';
import { validateHttpMethod } from '../middleware/validation';
import { validateApiKey } from '../middleware/auth';
import { Logger } from '../services/logger';
import { getAggregatedMetrics } from '../services/metrics';

export async function handleMetricsRequest(request: Request, env: Env): Promise<Response> {
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

    // Get aggregated metrics
    const metrics = await getAggregatedMetrics(env);

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': (Math.floor(Date.now() / 1000) + 3600).toString()
      })
    });
  } catch (error) {
    Logger.error('Metrics handler error', { requestId, error });
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics',
      requestId
    }), {
      status: 500,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      })
    });
  }
}
