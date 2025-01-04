export interface Env {
  API_KEYS: KVNamespace;
  INFLUXDB_URL: string;
  INFLUXDB_TOKEN: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
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
