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

export interface Env {
  API_KEYS: KVNamespace;
  METRICS: KVNamespace;
  INFLUXDB_TOKEN: string;
  INFLUXDB_URL: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
}

interface DependencyStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  message?: string;
}

export interface MetricsResponse {
  timestamp: string;
  version: string;
  status: {
    influxdb: DependencyStatus;
    kv_store: DependencyStatus;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  dependencies: {
    influxdb: DependencyStatus;
    kv_store: DependencyStatus;
  };
}
