// Ambient declarations for Cloudflare Workers types
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData | URLSearchParams): Promise<void>;
  delete(key: string): Promise<void>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObject;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObject {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  INFLUXDB_TOKEN: string;
  INFLUXDB_URL: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
  RATE_LIMITER: DurableObjectNamespace;
  API_KEYS: KVNamespace;
  CACHE: KVNamespace;
}

interface FetchEvent extends Event {
  request: Request;
  env: Env;
  respondWith(response: Response | Promise<Response>): void;
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
