import { z } from 'zod';
import { MeasurementRequestSchema } from './middleware/validation';

export interface Env {
  METRICS: KVNamespace;
  API_KEYS: KVNamespace;
  INFLUXDB_URL: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
  INFLUXDB_TOKEN: string;
}

// Infer the type from the Zod schema
export type Measurement = z.infer<typeof MeasurementRequestSchema>;

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  dependencies: {
    influxdb: {
      status: HealthStatus;
      latency: number;
      message?: string;
    };
    kv_store: {
      status: HealthStatus;
      latency: number;
      message?: string;
    };
  };
}

export interface MetricsResponse {
  timestamp: string;
  version: string;
  status: {
    influxdb: {
      status: HealthStatus;
      latency: number;
      message?: string;
    };
    kv_store: {
      status: HealthStatus;
      latency: number;
      message?: string;
    };
  };
}
