declare const INFLUXDB_URL: string;
declare const INFLUXDB_TOKEN: string;
declare const INFLUXDB_ORG: string;
declare const INFLUXDB_BUCKET: string;
declare const METRICS: KVNamespace;
declare const API_KEYS: KVNamespace;

// Read API version from version.json
const API_VERSION = '4.0.1'; // We'll keep this in sync with version.json

interface Measurement {
  device: {
    id: string;
    type: string;
  };
  readings: {
    temperature: number;
    humidity: number;
  };
  metadata: {
    timestamp?: string;
    location?: string;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  dependencies: {
    influxdb: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency: number;
      message?: string;
    };
    kv_store: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency: number;
      message?: string;
    };
  };
}

interface Env {
  METRICS: KVNamespace;
  API_KEYS: KVNamespace;
  INFLUXDB_URL: string;
  INFLUXDB_TOKEN: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
}

interface MetricsResponse {
  timestamp: string;
  version: string;
  system: {
    uptime: number;
    memory_usage: {
      total: number;
      used: number;
      free: number;
    };
  };
  dependencies: {
    influxdb: {
      status: string;
      latency: number;
      write_success_rate: number;
      read_success_rate: number;
      error_rate: number;
    };
    kv_store: {
      status: string;
      latency: number;
      read_success_rate: number;
      write_success_rate: number;
      error_rate: number;
    };
  };
  requests: {
    total: number;
    success: number;
    error: number;
    by_endpoint: {
      [key: string]: {
        total: number;
        success: number;
        error: number;
        avg_latency: number;
      };
    };
  };
}

interface RequestMetric {
  endpoint: string;
  method: string;
  status_code: number;
  latency: number;
  timestamp: string;
}

// Cache for metrics response
const METRICS_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_SIZE: 60, // 1 minute
  MAX_REQUESTS: 100 // 100 requests per minute
};

async function checkRateLimit(env: Env, apiKey: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - RATE_LIMIT.WINDOW_SIZE;
    const key = `ratelimit:${apiKey}:${Math.floor(now / RATE_LIMIT.WINDOW_SIZE)}`;
    const previousKey = `ratelimit:${apiKey}:${Math.floor(windowStart / RATE_LIMIT.WINDOW_SIZE)}`;

    // Get current and previous window counts
    const [currentCount, previousCount] = await Promise.all([
      env.METRICS.get(key),
      env.METRICS.get(previousKey)
    ]);

    // Calculate weighted count from previous window
    const previousWeight = (windowStart % RATE_LIMIT.WINDOW_SIZE) / RATE_LIMIT.WINDOW_SIZE;
    const weightedPreviousCount = Math.floor(parseInt(previousCount || '0') * previousWeight);
    const currentWindowCount = parseInt(currentCount || '0');
    const totalCount = currentWindowCount + weightedPreviousCount;

    if (totalCount >= RATE_LIMIT.MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }

    // Increment current window counter
    await env.METRICS.put(key, (currentWindowCount + 1).toString(), {
      expirationTtl: RATE_LIMIT.WINDOW_SIZE * 2 // Keep for 2 windows
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT.MAX_REQUESTS - totalCount - 1
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // If rate limiting fails, allow the request but log the error
    return { allowed: true, remaining: -1 };
  }
}

async function recordMetric(env: Env, endpoint: string, statusCode: number, latency: number) {
  try {
    // Record metrics in parallel
    await Promise.all([
      // Record latency in InfluxDB
      fetch(`${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: `api_requests,endpoint=${endpoint} latency=${latency}`
      }).catch(error => console.error('Failed to write to InfluxDB:', error)),

      // Update counter in KV store
      (async () => {
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
            // If increment operation failed, fallback to get-then-put
            const currentValue = await env.METRICS.get(counterKey);
            await env.METRICS.put(counterKey, ((parseInt(currentValue || '0') + 1)).toString(), { 
              expirationTtl: 86400 
            });
          } else {
            throw error;
          }
        }
      })()
    ]);
  } catch (error) {
    console.error('Error recording metrics:', error);
  }
}

async function getMetrics(env: Env, timeRange: string = '1h'): Promise<{
  total: number;
  success: number;
  error: number;
  by_endpoint: {
    [key: string]: {
      total: number;
      success: number;
      error: number;
      avg_latency: number;
    };
  };
}> {
  try {
    // Check cache first
    const cacheKey = `metrics:${timeRange}`;
    const cached = METRICS_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    const metrics = {
      total: 0,
      success: 0,
      error: 0,
      by_endpoint: {} as {
        [key: string]: {
          total: number;
          success: number;
          error: number;
          avg_latency: number;
        };
      }
    };

    // Get current hour for KV queries
    const now = new Date();
    const currentHour = now.toISOString().slice(0, 13);

    // Get KV data and InfluxDB data in parallel
    const [kvData, influxData] = await Promise.all([
      // KV metrics
      (async () => {
        const { keys } = await env.METRICS.list({ prefix: `${currentHour}:` });
        const values = await Promise.all(keys.map(key => env.METRICS.get(key.name)));
        return { keys, values };
      })(),

      // InfluxDB latencies - optimized query
      (async () => {
        const latencyQuery = `
        from(bucket: "${env.INFLUXDB_BUCKET}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r["_measurement"] == "api_requests")
          |> filter(fn: (r) => r["_field"] == "latency")
          |> aggregateWindow(every: ${timeRange}, fn: mean)
          |> group(columns: ["endpoint"])
          |> mean()
        `;

        const response = await fetch(`${env.INFLUXDB_URL}/api/v2/query?org=${env.INFLUXDB_ORG}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
          },
          body: latencyQuery
        });

        if (!response.ok) {
          console.error('Failed to fetch InfluxDB data:', await response.text());
          return [];
        }

        const text = await response.text();
        return text.split('\n').slice(1)
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => {
            const parts = line.split(',');
            if (parts.length < 7) return null;
            return {
              endpoint: parts[3],
              latency: parseFloat(parts[6])
            };
          })
          .filter((item): item is { endpoint: string; latency: number } => 
            item !== null && !isNaN(item.latency) && item.endpoint !== '_result'
          );
      })()
    ]);

    // Process KV data
    for (let i = 0; i < kvData.keys.length; i++) {
      const key = kvData.keys[i];
      const count = parseInt(kvData.values[i] || '0');
      const [hour, endpoint, statusCode] = key.name.split(':');

      if (!metrics.by_endpoint[endpoint]) {
        metrics.by_endpoint[endpoint] = {
          total: 0,
          success: 0,
          error: 0,
          avg_latency: 0
        };
      }

      const endpointMetrics = metrics.by_endpoint[endpoint];
      const status = parseInt(statusCode);
      
      endpointMetrics.total += count;
      if (status >= 400) {
        endpointMetrics.error += count;
        metrics.error += count;
      } else {
        endpointMetrics.success += count;
        metrics.success += count;
      }
      metrics.total += count;
    }

    // Add latencies
    for (const { endpoint, latency } of influxData) {
      if (metrics.by_endpoint[endpoint]) {
        metrics.by_endpoint[endpoint].avg_latency = latency;
      }
    }

    // Cache the result
    METRICS_CACHE.set(cacheKey, {
      data: metrics,
      timestamp: Date.now()
    });

    return metrics;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const startTime = Date.now();
  const endpoint = url.pathname;

  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Missing API key'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if API key exists
    const keyExists = await env.API_KEYS.get(apiKey);
    if (!keyExists) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid API key'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(env, apiKey);
    if (!rateLimitResult.allowed) {
      const resetTime = Math.floor(Date.now() / 1000) + RATE_LIMIT.WINDOW_SIZE;
      return new Response(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT.MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': RATE_LIMIT.WINDOW_SIZE.toString()
        }
      });
    }

    // Handle the request
    let response: Response;
    if (endpoint === '/metrics') {
      const metrics = await getMetrics(env);
      response = new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        version: API_VERSION,
        system: {
          memory_usage: {
            total: 512 * 1024 * 1024,
            used: 128 * 1024 * 1024,
            free: 384 * 1024 * 1024
          }
        },
        dependencies: {
          influxdb: await checkInfluxDB(env),
          kv_store: await checkKVStore(env)
        },
        requests: metrics
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      response = await handleOtherEndpoints(request, env);
    }

    // Add rate limit headers
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', RATE_LIMIT.MAX_REQUESTS.toString());
    headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    headers.set('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + RATE_LIMIT.WINDOW_SIZE).toString());

    // Record metric and return response
    await recordMetric(env, endpoint, response.status, Date.now() - startTime);
    return new Response(response.body, {
      status: response.status,
      headers
    });

  } catch (error) {
    console.error('Request error:', error);
    const response = new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    await recordMetric(env, endpoint, response.status, Date.now() - startTime);
    return response;
  }
}

async function handleTimeRequest(): Response {
  const currentTime = new Date().toISOString();
  return new Response(currentTime, {
    headers: { 'content-type': 'text/plain' },
  });
}

async function handleDateRequest(): Response {
  const currentDate = new Date().toLocaleDateString();
  return new Response(currentDate, {
    headers: { 'content-type': 'text/plain' },
  });
}

async function handleVersionRequest(): Response {
  return new Response(API_VERSION, {
    headers: { 'content-type': 'text/plain' },
  });
}

async function handleOtherEndpoints(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  let response: Response;
  
  try {
    if (url.pathname === '/time') {
      response = handleTimeRequest();
    } else if (url.pathname === '/date') {
      response = handleDateRequest();
    } else if (url.pathname === '/version') {
      response = handleVersionRequest();
    } else if (url.pathname === '/measurement') {
      response = await handleMeasurementRequest(request, env);
    } else if (url.pathname === '/health') {
      response = await handleHealthCheck(request, env);
    } else {
      response = new Response('Hello, World!', {
        headers: { 'content-type': 'text/plain' },
        status: 404
      });
    }
    return response;
  } catch (error) {
    console.error('Endpoint error:', error);
    response = new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return response;
  }
}

async function handleMeasurementRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: 'Only POST method is supported'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const measurement: Measurement = await request.json();
    
    // Validate required fields
    if (!measurement.device?.id || !measurement.device?.type || !measurement.readings?.temperature) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate data types and ranges
    if (typeof measurement.readings.temperature !== 'number') {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Temperature must be a number'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (measurement.readings.temperature < -273.15 || measurement.readings.temperature > 1000) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Temperature must be between -273.15°C and 1000°C'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (measurement.readings.humidity !== undefined) {
      if (typeof measurement.readings.humidity !== 'number' || 
          measurement.readings.humidity < 0 || 
          measurement.readings.humidity > 100) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'Humidity must be a number between 0 and 100'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Add timestamp if not provided
    if (!measurement.metadata) {
      measurement.metadata = {};
    }
    if (!measurement.metadata.timestamp) {
      measurement.metadata.timestamp = new Date().toISOString();
    }

    // Write to InfluxDB
    const data = `measurements,device_id=${measurement.device.id},device_type=${measurement.device.type} temperature=${measurement.readings.temperature}${measurement.readings.humidity ? `,humidity=${measurement.readings.humidity}` : ''}`;
    
    const response = await fetch(`${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: data
    });

    if (!response.ok) {
      console.error('Failed to write to InfluxDB:', await response.text());
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to store measurement'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      message: 'Measurement recorded successfully',
      timestamp: measurement.metadata.timestamp
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing measurement:', error);
    return new Response(JSON.stringify({
      error: 'Bad Request',
      message: 'Invalid measurement data'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function checkInfluxDB(env: Env): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message?: string }> {
  const start = performance.now();
  try {
    const response = await fetch(`${env.INFLUXDB_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const latency = performance.now() - start;

    if (!response.ok) {
      console.error('InfluxDB health check failed:', {
        status: response.status,
        statusText: response.statusText
      });
      return {
        status: 'unhealthy',
        latency,
        message: `InfluxDB responded with status: ${response.status} (${response.statusText})`
      };
    }

    if (latency > 1000) {
      console.warn('InfluxDB health check latency high:', latency);
      return {
        status: 'degraded',
        latency,
        message: 'High latency detected'
      };
    }

    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    console.error('InfluxDB health check error:', error);
    return {
      status: 'unhealthy',
      latency: performance.now() - start,
      message: `Failed to connect to InfluxDB: ${error.message}`
    };
  }
}

async function checkKVStore(env: Env): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message?: string }> {
  const start = performance.now();
  try {
    const testKey = 'health_check_test';
    const testValue = Date.now().toString();

    // Test write
    await env.API_KEYS.put(testKey, testValue);
    
    // Test read
    const readValue = await env.API_KEYS.get(testKey);
    
    // Test delete
    await env.API_KEYS.delete(testKey);

    const latency = performance.now() - start;

    if (readValue !== testValue) {
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
        message: 'High latency detected'
      };
    }

    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: performance.now() - start,
      message: error.message
    };
  }
}

async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({
        error: 'Method not allowed',
        message: 'Only GET method is allowed for this endpoint'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'GET'
        }
      });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'API key is required'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValidKey = await env.API_KEYS.get(apiKey);
    if (!isValidKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid API key'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [influxStatus, kvStatus] = await Promise.all([
      checkInfluxDB(env),
      checkKVStore(env)
    ]);

    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      dependencies: {
        influxdb: influxStatus,
        kv_store: kvStatus
      }
    };

    // Determine overall status
    if (influxStatus.status === 'unhealthy' || kvStatus.status === 'unhealthy') {
      healthStatus.status = 'unhealthy';
    } else if (influxStatus.status === 'degraded' || kvStatus.status === 'degraded') {
      healthStatus.status = 'degraded';
    }

    return new Response(JSON.stringify(healthStatus, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: healthStatus.status === 'unhealthy' ? 503 : 200
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while checking system health'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleMetrics(request: Request, env: Env): Promise<Response> {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'API key is required'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValidKey = await env.API_KEYS.get(apiKey);
    if (!isValidKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid API key'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [metrics, influxStatus, kvStatus] = await Promise.all([
      getMetrics(env),
      checkInfluxDB(env),
      checkKVStore(env)
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      system: {
        memory_usage: {
          total: 512 * 1024 * 1024,
          used: 128 * 1024 * 1024,
          free: 384 * 1024 * 1024
        }
      },
      dependencies: {
        influxdb: {
          status: influxStatus.status,
          latency: influxStatus.latency,
          write_success_rate: 99.9,
          read_success_rate: 99.95,
          error_rate: 0.1
        },
        kv_store: {
          status: kvStatus.status,
          latency: kvStatus.latency,
          read_success_rate: 99.99,
          write_success_rate: 99.95,
          error_rate: 0.05
        }
      },
      requests: metrics
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export default worker;
