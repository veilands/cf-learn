import { Env, HealthStatus } from '../types';

export async function checkInfluxDB(env: Env): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message?: string }> {
  const start = Date.now();
  try {
    if (!env.INFLUXDB_TOKEN) {
      return {
        status: 'unhealthy',
        latency: 0,
        message: 'INFLUXDB_TOKEN not configured'
      };
    }

    // Use the write endpoint to check if we can write data
    const response = await fetch(
      `${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: 'health_check,service=api value=1',
        signal: AbortSignal.timeout(3000) // Add 3-second timeout
      }
    );

    const latency = Date.now() - start;

    if (!response.ok) {
      const text = await response.text();
      return {
        status: 'unhealthy',
        latency,
        message: `HTTP ${response.status}: ${text}`
      };
    }

    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'High latency'
      };
    }

    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkKVStore(env: Env): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message?: string }> {
  const start = Date.now();
  const testKey = 'health_check_test';

  try {
    await env.METRICS.put(testKey, 'test', { expirationTtl: 60 });
    const value = await env.METRICS.get(testKey);
    const latency = Date.now() - start;

    if (value !== 'test') {
      return {
        status: 'unhealthy',
        latency,
        message: 'KV store read/write mismatch'
      };
    }

    if (latency > 500) {
      return {
        status: 'degraded',
        latency,
        message: 'High latency'
      };
    }

    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
