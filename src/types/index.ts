export interface Env {
  // KV Namespaces
  API_KEYS: KVNamespace;
  METRICS: KVNamespace;

  // Environment Variables
  INFLUXDB_URL: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;

  // Encrypted Secrets
  INFLUXDB_TOKEN: string;
}

export interface Measurement {
  device_id: string;
  temperature: number;
  humidity: number;
  timestamp?: string;
}

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>;

export type Middleware = (handler: Handler) => Handler;
