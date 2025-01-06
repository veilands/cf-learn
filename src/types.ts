import { z } from 'zod';
import { MeasurementRequestSchema } from './middleware/validation';

export interface Env {
  // KV Namespaces
  API_KEYS: KVNamespace;
  METRICS: KVNamespace;

  // Environment Variables
  INFLUXDB_URL: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
  INFLUXDB_TOKEN: string;

  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace;
}

// Infer the type from the Zod schema
export type Measurement = z.infer<typeof MeasurementRequestSchema>;

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyStatus {
  status: HealthStatus;
  latency: number;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  dependencies: {
    influxdb: DependencyStatus;
    kv_store: DependencyStatus;
  };
}

export interface MetricsResponse {
  timestamp: string;
  version: string;
  status: {
    influxdb: DependencyStatus;
    kv_store: DependencyStatus;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  resetTime?: number;
  error?: string;
  message?: string;
}
