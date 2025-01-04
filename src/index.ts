declare const INFLUXDB_URL: string;
declare const INFLUXDB_TOKEN: string;
declare const INFLUXDB_ORG: string;
declare const INFLUXDB_BUCKET: string;
declare const API_KEYS: any;

import { version } from './version.json';
const API_VERSION = version;

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
  uptime: number;
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
  system: {
    memory: {
      heap: {
        used: {
          value: number;
          unit: string;
        };
        total: {
          value: number;
          unit: string;
        };
        percentage: number;
      };
      rss: {
        value: number;
        unit: string;
      };
    };
    cpu: {
      usage: {
        user: {
          value: number;
          unit: string;
        };
        system: {
          value: number;
          unit: string;
        };
      };
    };
  };
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if the API key exists in the KV store
  const isValidKey = await API_KEYS.get(apiKey);

  if (!isValidKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  if (url.pathname === '/time') {
    return handleTimeRequest();
  }
  if (url.pathname === '/date') {
    return handleDateRequest();
  }
  if (url.pathname === '/version') {
    return handleVersionRequest();
  }
  if (url.pathname === '/measurement') {
    return handleMeasurementRequest(request);
  }
  if (url.pathname === '/health') {
    return handleHealthCheck(request);
  }
  if (url.pathname === '/metrics') {
    return handleMetrics(request);
  }
  return new Response('Hello, World!', {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleTimeRequest(): Response {
  const currentTime = new Date().toISOString();
  return new Response(currentTime, {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleDateRequest(): Response {
  const currentDate = new Date().toLocaleDateString();
  return new Response(currentDate, {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleVersionRequest(): Response {
  return new Response(API_VERSION, {
    headers: { 'content-type': 'text/plain' },
  });
}

async function handleMeasurementRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValidKey = await API_KEYS.get(apiKey);
  if (!isValidKey) {
    return new Response('Invalid API key', { status: 401 });
  }

  try {
    const data: Measurement = await request.json();
    const timestamp = data.metadata.timestamp || new Date().toISOString();

    const measurement = `temperature,device_id=${data.device.id},device_type=${data.device.type} value=${data.readings.temperature} ${Date.parse(timestamp) * 1000000}
humidity,device_id=${data.device.id},device_type=${data.device.type} value=${data.readings.humidity} ${Date.parse(timestamp) * 1000000}`;

    const response = await fetch(`${INFLUXDB_URL}/api/v2/write?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}&precision=ns`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: measurement,
    });

    if (!response.ok) {
      throw new Error(`InfluxDB responded with ${response.status}: ${await response.text()}`);
    }

    return new Response('Measurement stored successfully', { status: 201 });
  } catch (error) {
    return new Response(`Error storing measurement: ${error.message}`, { status: 500 });
  }
}

async function checkInfluxDB(env: Env): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message?: string }> {
  const start = performance.now();
  try {
    const response = await fetch(`${env.INFLUXDB_URL}/api/v2/ping`, {
      headers: {
        'Authorization': `Token ${env.INFLUXDB_TOKEN}`
      }
    });

    const latency = performance.now() - start;

    if (!response.ok) {
      return {
        status: 'unhealthy',
        latency,
        message: `InfluxDB responded with status: ${response.status}`
      };
    }

    if (latency > 1000) {
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
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValidKey = await env.API_KEYS.get(apiKey);
  if (!isValidKey) {
    return new Response('Invalid API key', { status: 401 });
  }

  const [influxStatus, kvStatus] = await Promise.all([
    checkInfluxDB(env),
    checkKVStore(env)
  ]);

  const memory = process.memoryUsage();
  const heapUsedPercentage = (memory.heapUsed / memory.heapTotal) * 100;

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    uptime: process.uptime(),
    dependencies: {
      influxdb: influxStatus,
      kv_store: kvStatus
    },
    system: {
      memory: {
        heap: {
          used: {
            value: memory.heapUsed,
            unit: 'bytes'
          },
          total: {
            value: memory.heapTotal,
            unit: 'bytes'
          },
          percentage: heapUsedPercentage
        },
        rss: {
          value: memory.rss,
          unit: 'bytes'
        }
      },
      cpu: {
        usage: {
          user: {
            value: process.cpuUsage().user,
            unit: 'microseconds'
          },
          system: {
            value: process.cpuUsage().system,
            unit: 'microseconds'
          }
        }
      }
    }
  };

  // Determine overall status
  if (influxStatus.status === 'unhealthy' || kvStatus.status === 'unhealthy') {
    healthStatus.status = 'unhealthy';
  } else if (influxStatus.status === 'degraded' || kvStatus.status === 'degraded' || heapUsedPercentage > 90) {
    healthStatus.status = 'degraded';
  }

  return new Response(JSON.stringify(healthStatus, null, 2), {
    headers: { 'Content-Type': 'application/json' },
    status: healthStatus.status === 'unhealthy' ? 503 : 200
  });
}

async function handleMetrics(request: Request, env: Env): Promise<Response> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValidKey = await env.API_KEYS.get(apiKey);
  if (!isValidKey) {
    return new Response('Invalid API key', { status: 401 });
  }

  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: {
        value: process.uptime(),
        unit: 'seconds'
      },
      memory: {
        heap: {
          used: {
            value: process.memoryUsage().heapUsed,
            unit: 'bytes'
          },
          total: {
            value: process.memoryUsage().heapTotal,
            unit: 'bytes'
          }
        },
        rss: {
          value: process.memoryUsage().rss,
          unit: 'bytes'
        }
      },
      cpu: {
        usage: {
          user: {
            value: process.cpuUsage().user,
            unit: 'microseconds'
          },
          system: {
            value: process.cpuUsage().system,
            unit: 'microseconds'
          }
        }
      }
    }
  };
  
  return new Response(JSON.stringify(metrics, null, 2), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}
