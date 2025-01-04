import { Env, MetricsResponse } from '../types';
import { getMetricsCache } from '../services/metrics';
import { checkInfluxDB, checkKVStore } from '../services/health';

const { METRICS_CACHE, CACHE_TTL } = getMetricsCache();

export async function handleMetrics(request: Request, env: Env): Promise<Response> {
  try {
    // Check cache first
    const cacheKey = request.url;
    const cached = METRICS_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get dependency health status
    const [influxStatus, kvStatus] = await Promise.all([
      checkInfluxDB(env),
      checkKVStore(env)
    ]);

    const metrics: MetricsResponse = {
      timestamp: new Date().toISOString(),
      version: '4.0.1',
      system: {
        uptime: process.uptime(),
        memory_usage: {
          total: 0, // Not available in Workers
          used: 0,
          free: 0
        }
      },
      dependencies: {
        influxdb: {
          status: influxStatus.status,
          latency: influxStatus.latency,
          write_success_rate: 0,
          read_success_rate: 0,
          error_rate: 0
        },
        kv_store: {
          status: kvStatus.status,
          latency: kvStatus.latency,
          read_success_rate: 0,
          write_success_rate: 0,
          error_rate: 0
        }
      },
      requests: {
        total: 0,
        success: 0,
        error: 0,
        by_endpoint: {}
      }
    };

    // Cache the response
    METRICS_CACHE.set(cacheKey, {
      data: metrics,
      timestamp: Date.now()
    });

    return new Response(JSON.stringify(metrics), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch metrics' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
