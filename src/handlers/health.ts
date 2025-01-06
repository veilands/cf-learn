import { Env, HealthResponse, HealthStatus } from '../types';
import { validateHttpMethod } from '../middleware/validation';
import { withCache } from '../middleware/cache';
import { HealthService } from '../services/health';
import { version } from '../version.json';

async function handleHealthRequestInternal(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) return methodError;

    // Check KV store health
    const kvStatus = await HealthService.checkKVStore(env);

    // Check InfluxDB health
    const influxStatus = await HealthService.checkInfluxDB(env);

    const timestamp = new Date().toISOString();

    const systemStatus: HealthStatus = kvStatus.status === 'healthy' && influxStatus.status === 'healthy' 
      ? 'healthy' 
      : 'degraded';

    const response: HealthResponse = {
      status: systemStatus,
      timestamp,
      version,
      dependencies: {
        influxdb: influxStatus,
        kv_store: kvStatus
      }
    };

    return new Response(JSON.stringify(response), {
      status: systemStatus === 'healthy' ? 200 : 503,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60'
      })
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}

// Cache health endpoint for 30 seconds
export const handleHealthRequest = withCache(handleHealthRequestInternal, {
  cacheDuration: 30
});
