declare const INFLUXDB_URL: string;
declare const INFLUXDB_TOKEN: string;
declare const INFLUXDB_ORG: string;
declare const INFLUXDB_BUCKET: string;
declare const API_KEYS: any;

import { version } from './version.json';
const API_VERSION = version;

interface Measurement {
  device_id: string;
  temperature: number;
  humidity: number;
  timestamp?: string;
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

  try {
    const measurement: Measurement = await request.json();
    
    // Add timestamp if not provided
    if (!measurement.timestamp) {
      measurement.timestamp = new Date().toISOString();
    }

    // Construct InfluxDB Line Protocol
    const lineProtocol = `temperature,device=${measurement.device_id} value=${measurement.temperature} ${Date.parse(measurement.timestamp) * 1000000}
humidity,device=${measurement.device_id} value=${measurement.humidity} ${Date.parse(measurement.timestamp) * 1000000}`;

    // Send to InfluxDB
    const response = await fetch(INFLUXDB_URL + '/api/v2/write?org=' + INFLUXDB_ORG + '&bucket=' + INFLUXDB_BUCKET, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: lineProtocol,
    });

    if (!response.ok) {
      throw new Error(`InfluxDB responded with status: ${response.status}`);
    }

    return new Response('Measurement stored successfully', { status: 201 });
  } catch (error) {
    return new Response(`Error storing measurement: ${error.message}`, { status: 500 });
  }
}
