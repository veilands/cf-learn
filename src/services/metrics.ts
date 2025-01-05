import { Env, Measurement } from '../types';
import Logger from '../services/logger';

const CACHE_TTL = 10000; // 10 seconds

// Sanitize strings for InfluxDB line protocol
function sanitizeTag(value: string): string {
  return value.replace(/[,= ]/g, '\\$&');
}

export async function recordMetric(env: Env, endpoint: string, status: number, duration: number) {
  try {
    const line = `api_metrics,endpoint=${sanitizeTag(endpoint)} status=${status},duration=${duration} ${Date.now() * 1000000}`;
    
    // Build URL with encoded parameters
    const baseUrl = env.INFLUXDB_URL.endsWith('/') ? env.INFLUXDB_URL.slice(0, -1) : env.INFLUXDB_URL;
    const url = new URL('/api/v2/write', baseUrl);
    url.searchParams.set('org', env.INFLUXDB_ORG);
    url.searchParams.set('bucket', env.INFLUXDB_BUCKET);
    url.searchParams.set('precision', 'ns');

    // Check if InfluxDB URL is valid
    if (!url.toString().startsWith('https://')) {
      throw new Error('Invalid InfluxDB URL');
    }

    // Check if InfluxDB token is present
    if (!env.INFLUXDB_TOKEN) {
      throw new Error('InfluxDB token is not configured');
    }

    // Write to InfluxDB
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/json'
      },
      body: line
    });

    if (!response.ok) {
      const text = await response.text();
      Logger.error('InfluxDB write failed', {
        status: response.status,
        statusText: response.statusText,
        response: text,
        url: url.toString()
      });
      throw new Error(`Failed to write to InfluxDB: ${response.status} ${text}`);
    }

    Logger.debug('Successfully wrote metrics to InfluxDB', {
      endpoint,
      status,
      duration
    });

    return { success: true };
  } catch (error) {
    Logger.error('Failed to record metric', {
      endpoint,
      status,
      duration,
      error
    });
    return { success: false, error };
  }
}

export async function recordMeasurement(measurement: Measurement, env: Env, requestId: string) {
  try {
    const { device, readings, metadata } = measurement;
    
    Logger.debug('Building InfluxDB line protocol', {
      requestId,
      device,
      readings,
      metadata
    });

    // Build tags
    const tags = [
      `device_id=${sanitizeTag(device.id)}`,
      `device_type=${sanitizeTag(device.type)}`
    ];
    if (metadata?.location) {
      tags.push(`location=${sanitizeTag(metadata.location)}`);
    }
    
    // Build fields
    const fields = [
      `temperature=${readings.temperature}`
    ];
    if (readings.humidity !== undefined) {
      fields.push(`humidity=${readings.humidity}`);
    }
    if (readings.battery_voltage !== undefined) {
      fields.push(`battery_voltage=${readings.battery_voltage}`);
    }
    
    // Build line protocol
    const timestamp = metadata?.timestamp ? new Date(metadata.timestamp).getTime() * 1000000 : Date.now() * 1000000;
    const line = `measurements,${tags.join(',')} ${fields.join(',')} ${timestamp}`;
    
    // Build URL with encoded parameters
    const baseUrl = env.INFLUXDB_URL.endsWith('/') ? env.INFLUXDB_URL.slice(0, -1) : env.INFLUXDB_URL;
    const url = new URL('/api/v2/write', baseUrl);
    url.searchParams.set('org', env.INFLUXDB_ORG);
    url.searchParams.set('bucket', env.INFLUXDB_BUCKET);
    url.searchParams.set('precision', 'ns');

    Logger.debug('Sending data to InfluxDB', {
      requestId,
      line,
      url: url.toString(),
      org: env.INFLUXDB_ORG,
      bucket: env.INFLUXDB_BUCKET
    });

    // Check if InfluxDB URL is valid
    if (!url.toString().startsWith('https://')) {
      throw new Error('Invalid InfluxDB URL');
    }

    // Check if InfluxDB token is present
    if (!env.INFLUXDB_TOKEN) {
      throw new Error('InfluxDB token is not configured');
    }

    // Write to InfluxDB
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/json'
      },
      body: line
    });

    if (!response.ok) {
      const text = await response.text();
      Logger.error('InfluxDB write failed', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        response: text,
        url: url.toString()
      });
      throw new Error(`Failed to write to InfluxDB: ${response.status} ${text}`);
    }

    Logger.debug('Successfully wrote data to InfluxDB', {
      requestId,
      status: response.status
    });

    return { success: true };
  } catch (error) {
    Logger.error('Failed to record measurement', {
      requestId,
      error
    });
    return { success: false, error };
  }
}

// Cache metrics in KV store
export async function getMetricsFromCache(env: Env, cacheKey: string): Promise<any | null> {
  try {
    const data = await env.METRICS.get(cacheKey);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    Logger.error('Failed to get metrics from cache', { error });
    return null;
  }
}

export async function setMetricsCache(env: Env, cacheKey: string, data: any): Promise<void> {
  try {
    await env.METRICS.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL });
  } catch (error) {
    Logger.error('Failed to set metrics cache', { error });
  }
}
