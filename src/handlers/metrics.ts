import { Env, MetricsResponse, HealthStatus } from '../types';
import versionInfo from '../version.json';
import { checkKVStore, checkInfluxDB } from '../services/health';
import { validateHttpMethod, createErrorResponse } from '../middleware/validation';
import Logger from '../services/logger';

export async function handleMetrics(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const endpoint = '/metrics';

  try {
    Logger.info('Processing metrics request', {
      requestId,
      endpoint,
      method: request.method
    });

    // Validate HTTP method
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) {
      Logger.warn('Invalid method for metrics endpoint', {
        requestId,
        endpoint,
        method: request.method
      });
      return methodError;
    }

    // Get health status for all dependencies
    const [influxStatus, kvStatus] = await Promise.all([
      checkInfluxDB(env).catch(error => {
        Logger.error('InfluxDB health check failed', {
          requestId,
          endpoint,
          error
        });
        return {
          status: 'unhealthy' as HealthStatus,
          latency: 0,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }),
      checkKVStore(env).catch(error => {
        Logger.error('KV health check failed', {
          requestId,
          endpoint,
          error
        });
        return {
          status: 'unhealthy' as HealthStatus,
          latency: 0,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      })
    ]);

    const duration_ms = Date.now() - start;
    const metrics: MetricsResponse = {
      timestamp: new Date().toISOString(),
      version: versionInfo.version,
      status: {
        influxdb: {
          status: influxStatus.status,
          latency: influxStatus.latency,
          message: influxStatus.message
        },
        kv_store: {
          status: kvStatus.status,
          latency: kvStatus.latency,
          message: kvStatus.message
        }
      }
    };

    Logger.request({
      requestId,
      method: request.method,
      endpoint,
      status: 200,
      duration_ms,
      data: {
        influxdb_status: influxStatus.status,
        kv_status: kvStatus.status
      }
    });

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    const duration_ms = Date.now() - start;
    Logger.error('Failed to fetch metrics', {
      requestId,
      endpoint,
      method: request.method,
      error,
      data: { duration_ms }
    });

    return createErrorResponse(
      500,
      'Internal Server Error',
      error instanceof Error ? error.message : 'Failed to fetch metrics',
      requestId
    );
  }
}
