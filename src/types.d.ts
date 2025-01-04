interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData | URLSearchParams): Promise<void>;
  delete(key: string): Promise<void>;
}

interface FetchEvent extends Event {
  request: Request;
  env: Env;
  respondWith(response: Response | Promise<Response>): void;
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface Env {
  API_KEYS: KVNamespace;
  METRICS: KVNamespace;
  JWT_SECRET: string;
  ACCESS_TOKEN_EXPIRES: string;
  REFRESH_TOKEN_EXPIRES: string;
  INFLUXDB_URL: string;
  INFLUXDB_TOKEN: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
}
