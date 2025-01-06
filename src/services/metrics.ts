import { Env } from '../types';
import { Logger } from './logger';

const METRICS_TTL = 3600; // 1 hour in seconds
const METRICS_KEYS = {
  REQUEST_COUNTS: 'metrics:request_counts',
  ERROR_RATES: 'metrics:error_rates',
  RESPONSE_TIMES: 'metrics:response_times',
  RATE_LIMITS: 'metrics:rate_limits',
  INFLUXDB_WRITES: 'metrics:influxdb_writes'
};

interface RequestMetrics {
  timestamp: string;
  endpoint: string;
  status: number;
  duration: number;
  cf?: {
    colo?: string;
    country?: string;
    asn?: number;
  };
}

interface AggregatedMetrics {
  requests: {
    total: number;
    success: number;
    error: number;
    by_endpoint: Record<string, number>;
  };
  performance: {
    avg_response_time: number;
    p95_response_time: number;
    p99_response_time: number;
    by_endpoint: Record<string, {
      avg: number;
      p95: number;
      p99: number;
    }>;
  };
  rate_limits: {
    total_limited: number;
    by_endpoint: Record<string, number>;
  };
  influxdb: {
    writes: number;
    errors: number;
    avg_batch_size: number;
  };
  system: {
    cache_hits: number;
    cache_misses: number;
  };
  geo: {
    requests_by_country: Record<string, number>;
    requests_by_colo: Record<string, number>;
  };
}

export async function recordRequestMetrics(env: Env, metrics: RequestMetrics): Promise<void> {
  try {
    const key = `${METRICS_KEYS.REQUEST_COUNTS}:${new Date().toISOString().split('T')[0]}`;
    const currentMetrics = await env.METRICS.get(key);
    const data = currentMetrics ? JSON.parse(currentMetrics) : [];
    data.push(metrics);
    
    // Store with TTL
    await env.METRICS.put(key, JSON.stringify(data), { expirationTtl: METRICS_TTL });
    
    Logger.debug('Recorded request metrics', { metrics });
  } catch (error) {
    Logger.error('Failed to record request metrics', { error });
  }
}

export async function getAggregatedMetrics(env: Env): Promise<AggregatedMetrics> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${METRICS_KEYS.REQUEST_COUNTS}:${today}`;
    const rawMetrics = await env.METRICS.get(key);
    const metrics: RequestMetrics[] = rawMetrics ? JSON.parse(rawMetrics) : [];

    // Calculate aggregated metrics
    const aggregated: AggregatedMetrics = {
      requests: {
        total: metrics.length,
        success: metrics.filter(m => m.status < 400).length,
        error: metrics.filter(m => m.status >= 400).length,
        by_endpoint: {}
      },
      performance: {
        avg_response_time: 0,
        p95_response_time: 0,
        p99_response_time: 0,
        by_endpoint: {}
      },
      rate_limits: {
        total_limited: metrics.filter(m => m.status === 429).length,
        by_endpoint: {}
      },
      influxdb: {
        writes: 0,
        errors: 0,
        avg_batch_size: 0
      },
      system: {
        cache_hits: 0,
        cache_misses: 0
      },
      geo: {
        requests_by_country: {},
        requests_by_colo: {}
      }
    };

    // Calculate endpoint-specific metrics
    metrics.forEach(m => {
      // Request counts by endpoint
      aggregated.requests.by_endpoint[m.endpoint] = (aggregated.requests.by_endpoint[m.endpoint] || 0) + 1;

      // Geographic distribution
      if (m.cf?.country) {
        aggregated.geo.requests_by_country[m.cf.country] = (aggregated.geo.requests_by_country[m.cf.country] || 0) + 1;
      }
      if (m.cf?.colo) {
        aggregated.geo.requests_by_colo[m.cf.colo] = (aggregated.geo.requests_by_colo[m.cf.colo] || 0) + 1;
      }
    });

    // Calculate performance metrics
    if (metrics.length > 0) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      aggregated.performance.avg_response_time = durations.reduce((a, b) => a + b, 0) / durations.length;
      aggregated.performance.p95_response_time = durations[Math.floor(durations.length * 0.95)];
      aggregated.performance.p99_response_time = durations[Math.floor(durations.length * 0.99)];
    }

    return aggregated;
  } catch (error) {
    Logger.error('Failed to get aggregated metrics', { error });
    throw error;
  }
}

export async function recordInfluxDBMetrics(env: Env, writes: number, errors: number, batchSize: number): Promise<void> {
  try {
    const key = `${METRICS_KEYS.INFLUXDB_WRITES}:${new Date().toISOString().split('T')[0]}`;
    const current = await env.METRICS.get(key);
    const data = current ? JSON.parse(current) : { writes: 0, errors: 0, total_batch_size: 0, batch_count: 0 };
    
    data.writes += writes;
    data.errors += errors;
    data.total_batch_size += batchSize;
    data.batch_count += 1;
    
    await env.METRICS.put(key, JSON.stringify(data), { expirationTtl: METRICS_TTL });
  } catch (error) {
    Logger.error('Failed to record InfluxDB metrics', { error });
  }
}
