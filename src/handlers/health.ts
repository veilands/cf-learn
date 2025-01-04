import { Env, HealthStatus } from '../types';
import { checkInfluxDB, checkKVStore } from '../services/health';

export async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  try {
    const [influxStatus, kvStatus] = await Promise.all([
      checkInfluxDB(env),
      checkKVStore(env)
    ]);

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '4.0.1',
      dependencies: {
        influxdb: influxStatus,
        kv_store: kvStatus
      }
    };

    // Determine overall health status
    if (influxStatus.status === 'unhealthy' || kvStatus.status === 'unhealthy') {
      health.status = 'unhealthy';
    } else if (influxStatus.status === 'degraded' || kvStatus.status === 'degraded') {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(health), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const health: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '4.0.1',
      dependencies: {
        influxdb: {
          status: 'unhealthy',
          latency: -1,
          message: 'Health check failed'
        },
        kv_store: {
          status: 'unhealthy',
          latency: -1,
          message: 'Health check failed'
        }
      }
    };

    return new Response(JSON.stringify(health), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
