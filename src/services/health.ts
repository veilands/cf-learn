import { Env, DependencyStatus, HealthStatus } from '../types';
import { Logger } from './logger';

type HealthStatus = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  message?: string;
};

interface InfluxDBHealthResponse {
  status: 'pass' | 'fail';
  message?: string;
}

export async function checkInfluxDB(env: Env): Promise<DependencyStatus> {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(
        `${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
            'Content-Type': 'text/plain'
          },
          body: 'health_check,service=api value=1',
          signal: controller.signal
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
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const latency = Date.now() - start;
    Logger.error('InfluxDB health check failed', { error });
    return {
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkKVStore(env: Env): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const testKey = 'health_check';
    const testValue = 'ok';
    
    await env.API_KEYS.put(testKey, testValue, { expirationTtl: 60 });
    const value = await env.API_KEYS.get(testKey);
    await env.API_KEYS.delete(testKey);

    const latency = Date.now() - start;
    
    if (value !== testValue) {
      return {
        status: 'unhealthy',
        latency,
        message: 'KV store read/write test failed'
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
    const latency = Date.now() - start;
    Logger.error('KV health check failed', { error });
    return {
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkInfluxDBHealth(env: Env): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`${env.INFLUXDB_URL}/health`, {
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`
        },
        signal: controller.signal
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        const error = await response.text();
        return {
          status: 'degraded',
          latency,
          message: `InfluxDB health check failed: ${error}`
        };
      }

      const data = await response.json() as InfluxDBHealthResponse;
      
      return {
        status: data.status === 'pass' ? 'healthy' : 'degraded',
        latency,
        message: data.status !== 'pass' ? `InfluxDB status: ${data.status}` : undefined
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const latency = Date.now() - start;
    Logger.error('InfluxDB health check failed', { error });
    return {
      status: 'degraded',
      latency,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export class HealthService {
  static async checkHealth(env: Env) {
    const kvStatus = await this.checkKVStore(env);
    const influxStatus = await this.checkInfluxDB(env);
    
    const timestamp = new Date().toISOString();
    const overallStatus = kvStatus.status === 'healthy' && influxStatus.status === 'healthy' 
      ? 'healthy' 
      : 'unhealthy';

    return {
      timestamp,
      status: overallStatus,
      dependencies: {
        kv_store: kvStatus,
        influxdb: influxStatus
      }
    };
  }

  static async checkKVStore(env: Env): Promise<{ status: HealthStatus; latency: number; message?: string }> {
    const start = Date.now();
    try {
      // Try to access KV store
      await env.API_KEYS.get('test_key');
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      Logger.error('KV store health check failed', { error });
      return {
        status: 'unhealthy',
        latency,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async checkInfluxDB(env: Env): Promise<{ status: HealthStatus; latency: number; message?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`${env.INFLUXDB_URL}/health`, {
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`
        }
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        throw new Error(`InfluxDB returned status ${response.status}`);
      }

      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      Logger.error('InfluxDB health check failed', { error });
      return {
        status: 'unhealthy',
        latency,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
