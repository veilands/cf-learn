import { Env } from '../types';
import { handleMetrics } from './metrics';
import { validateHttpMethod, createErrorResponse } from '../middleware/validation';
import Logger from '../services/logger';
import { withCache } from '../middleware/cache';

interface MetricsResponse {
  timestamp: string;
  version: string;
  status: {
    influxdb: {
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
    kv_store: {
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
  };
}

async function handleHealthCheckInternal(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const endpoint = '/health';

  try {
    Logger.info('Processing health check request', {
      requestId,
      endpoint,
      method: request.method
    });

    // Validate HTTP method
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) {
      Logger.warn('Invalid method for health endpoint', {
        requestId,
        endpoint,
        method: request.method
      });
      return methodError;
    }

    // Get metrics response
    const metricsResponse = await handleMetrics(request, env);
    const metrics = await metricsResponse.json() as MetricsResponse;

    // Determine overall health status
    let status = 'healthy';
    if (metrics.status.influxdb.status === 'unhealthy' || metrics.status.kv_store.status === 'unhealthy') {
      status = 'unhealthy';
    } else if (metrics.status.influxdb.status === 'degraded' || metrics.status.kv_store.status === 'degraded') {
      status = 'degraded';
    }

    const health = {
      status,
      timestamp: metrics.timestamp,
      version: metrics.version,
      dependencies: {
        influxdb: metrics.status.influxdb,
        kv_store: metrics.status.kv_store
      }
    };

    const statusCode = status === 'healthy' ? 200 : 
                      status === 'degraded' ? 200 : 503;

    const duration_ms = Date.now() - start;
    Logger.request({
      requestId,
      method: request.method,
      endpoint,
      status: statusCode,
      duration_ms,
      data: {
        health_status: status,
        influxdb_status: metrics.status.influxdb.status,
        kv_status: metrics.status.kv_store.status
      }
    });

    return new Response(JSON.stringify(health), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const duration_ms = Date.now() - start;
    Logger.error('Health check failed', {
      requestId,
      endpoint,
      method: request.method,
      error,
      data: { duration_ms }
    });

    return createErrorResponse(
      503,
      'Service Unavailable',
      'Health check failed',
      requestId
    );
  }
}

// Cache health endpoint for 30 seconds to avoid hammering dependencies
export const handleHealthCheck = withCache(handleHealthCheckInternal, {
  cacheDuration: 30, // 30 seconds
  cacheBypass: 'no-cache' // Allow bypass with Cache-Control: no-cache
});
