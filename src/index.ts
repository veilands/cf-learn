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

// Breaking change: require authentication for health check
async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValidKey = await env.API_KEYS.get(apiKey);
  if (!isValidKey) {
    return new Response('Invalid API key', { status: 401 });
  }

  return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}

async function handleMetrics(request: Request): Promise<Response> {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: {
      user: process.cpuUsage().user,
      system: process.cpuUsage().system
    },
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(metrics), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}
