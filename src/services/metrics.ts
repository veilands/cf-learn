import { Env } from '../types';

// Cache for metrics response
const METRICS_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

export async function recordMetric(env: Env, endpoint: string, statusCode: number, latency: number) {
  try {
    await Promise.all([
      recordInfluxMetric(env, endpoint, latency),
      recordKVMetric(env, endpoint, statusCode)
    ]);
  } catch (error) {
    console.error('Error recording metrics:', error);
  }
}

async function recordInfluxMetric(env: Env, endpoint: string, latency: number) {
  return fetch(`${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
      'Content-Type': 'text/plain'
    },
    body: `api_requests,endpoint=${endpoint} latency=${latency}`
  }).catch(error => console.error('Failed to write to InfluxDB:', error));
}

async function recordKVMetric(env: Env, endpoint: string, statusCode: number) {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const counterKey = `${hour}:${endpoint}:${statusCode}`;
  
  try {
    await env.METRICS.put(counterKey, '1', { 
      expirationTtl: 86400,
      metadata: { increment: true } 
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('increment')) {
      const currentValue = await env.METRICS.get(counterKey);
      await env.METRICS.put(counterKey, ((parseInt(currentValue || '0') + 1)).toString(), { 
        expirationTtl: 86400 
      });
    } else {
      throw error;
    }
  }
}

export function getMetricsCache() {
  return {
    METRICS_CACHE,
    CACHE_TTL
  };
}
