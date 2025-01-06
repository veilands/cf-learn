import { z } from 'zod';
import { Logger } from '../services/logger';
import { Env } from '../types';

// Common schemas
export const ApiKeySchema = z.object({
  'x-api-key': z.string().min(1)
}).strict();

// Request schemas
export const MeasurementRequestSchema = z.object({
  device_name: z.string().min(1).describe('IoT device name'),
  location: z.string().min(1).describe('Device location'),
  battery_voltage: z.number().min(0).max(5).describe('Battery voltage in volts (0-5V)'),
  temperature: z.number().describe('Temperature in Celsius'),
  humidity: z.number().min(0).max(100).describe('Relative humidity percentage (0-100%)'),
  timestamp: z.string().datetime().optional().describe('ISO 8601 timestamp')
}).strict();

export const BulkMeasurementRequestSchema = z.object({
  device_name: z.string().min(1).describe('IoT device name'),
  location: z.string().min(1).describe('Device location'),
  measurements: z.array(z.object({
    battery_voltage: z.number().min(0).max(5).describe('Battery voltage in volts (0-5V)'),
    temperature: z.number().describe('Temperature in Celsius'),
    humidity: z.number().min(0).max(100).describe('Relative humidity percentage (0-100%)'),
    timestamp: z.string().datetime().describe('ISO 8601 timestamp')
  })).min(1).max(1000).describe('Array of measurements (max 1000 per request)')
}).strict();

// Response schemas
export const TimeResponseSchema = z.object({
  iso: z.string().datetime(),
  timestamp: z.number().int().positive(),
  timezone: z.object({
    offset: z.number().int(),
    name: z.string()
  }).strict(),
  date: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    weekday: z.number().int().min(0).max(6)
  }).strict(),
  time: z.object({
    hours: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0).max(59),
    seconds: z.number().int().min(0).max(59),
    milliseconds: z.number().int().min(0).max(999)
  }).strict()
}).strict();

export const VersionResponseSchema = z.object({
  version: z.string(),
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  patch: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  api: z.object({
    endpoints: z.array(z.string()),
    baseUrl: z.string().url()
  }).strict()
}).strict();

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  dependencies: z.object({
    influxdb: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latency: z.number(),
      message: z.string().optional()
    }).strict(),
    kvstore: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latency: z.number(),
      message: z.string().optional()
    }).strict()
  }).strict()
}).strict();

export const MetricsResponseSchema = z.object({
  timestamp: z.string(),
  version: z.string(),
  status: z.object({
    influxdb: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latency: z.number(),
      message: z.string().optional()
    }).strict(),
    kv_store: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latency: z.number(),
      message: z.string().optional()
    }).strict()
  }).strict()
}).strict();

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string().uuid().optional(),
  code: z.number().int().optional()
}).strict();

/** Error response type */
export interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

// Create error response
export function createErrorResponse(
  status: number,
  requestId: string | null | undefined,
  error: string,
  message?: string
): Response {
  return new Response(
    JSON.stringify({
      error,
      message: message || error,
      requestId: requestId || 'unknown',
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// HTTP method validation middleware
export function validateHttpMethod(
  request: Request,
  allowedMethods: string[],
  requestId?: string
): Response | null {
  if (!allowedMethods.includes(request.method)) {
    return createErrorResponse(
      405,
      requestId,
      'Method Not Allowed',
      `This endpoint only supports ${allowedMethods.join(', ')} methods`
    );
  }
  return null;
}

// Content-type validation middleware
export function validateContentType(request: Request, contentType: string, requestId?: string): Response | null {
  const requestContentType = request.headers.get('content-type');
  if (!requestContentType || !requestContentType.includes(contentType)) {
    return createErrorResponse(
      400,
      requestId,
      'Bad Request',
      `Content-Type must be ${contentType}`
    );
  }
  return null;
}

// Validation middleware
export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  requestId: string | null | undefined
): Response | z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return createErrorResponse(
      400,
      requestId,
      'Bad Request',
      result.error.errors[0].message
    );
  }
  return result.data;
}

// Response validation
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  requestId: string | null | undefined
): Response | T {
  const result = schema.safeParse(data);
  if (!result.success) {
    return createErrorResponse(
      500,
      requestId,
      'Internal Server Error',
      'Invalid response format'
    );
  }
  return result.data;
}

export async function validateApiKey(
  request: Request,
  env: Env
): Promise<Response | null> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return createErrorResponse(401, request.headers.get('x-request-id') || 'unknown', 'Unauthorized', 'Missing API key');
  }

  try {
    const isValid = await env.API_KEYS.get(apiKey);
    if (!isValid) {
      return createErrorResponse(401, request.headers.get('x-request-id') || 'unknown', 'Unauthorized', 'Invalid API key');
    }
    return null;
  } catch (error) {
    return createErrorResponse(500, request.headers.get('x-request-id') || 'unknown', 'Internal Server Error', 'API key validation failed');
  }
}
