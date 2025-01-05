import { z } from 'zod';
import { Logger } from '../services/logger';

// Common schemas
export const ApiKeySchema = z.object({
  'x-api-key': z.string().min(1)
}).strict();

// Request schemas
export const MeasurementRequestSchema = z.object({
  device: z.object({
    id: z.string().min(1),
    type: z.string().min(1)
  }).strict(),
  readings: z.object({
    temperature: z.number(),
    humidity: z.number().optional(),
    battery_voltage: z.number().min(0).max(5).optional().describe('Battery voltage in volts (0-5V)')
  }).strict(),
  metadata: z.object({
    location: z.string().optional(),
    timestamp: z.string().datetime().optional()
  }).strict().optional()
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
  requestId: string,
  error: string,
  message?: string
): Response {
  const errorResponse = {
    error,
    message,
    requestId
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
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
  if (request.headers.get('content-type') !== contentType) {
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
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown,
  requestId: string
): Response | z.infer<T> {
  try {
    const result = schema.safeParse(data);
    if (!result.success) {
      Logger.warn('Validation failed', { 
        requestId, 
        errors: result.error.errors 
      });
      return createErrorResponse(
        400,
        requestId,
        'Bad Request',
        result.error.errors[0].message
      );
    }
    return result.data;
  } catch (error) {
    Logger.error('Unexpected validation error', { 
      requestId, 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    return createErrorResponse(
      500,
      requestId,
      'Internal Server Error',
      'Validation failed: Unexpected error'
    );
  }
}

export function validateResponse<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  requestId: string
): Response | T {
  try {
    Logger.debug('Validating response', { requestId, data });
    const result = schema.safeParse(data);
    if (!result.success) {
      Logger.error('Response validation failed', { 
        requestId, 
        errors: result.error.errors 
      });
      return createErrorResponse(
        500,
        requestId,
        'Internal Server Error',
        'Response validation failed'
      );
    }
    Logger.debug('Response validation successful', { requestId });
    return result.data;
  } catch (error) {
    Logger.error('Unexpected response validation error', { 
      requestId, 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    return createErrorResponse(
      500,
      requestId,
      'Internal Server Error',
      'Response validation failed: Unexpected error'
    );
  }
}

// Helper to extract and validate API key
export async function validateApiKey(
  apiKey: string | null,
  env: Env,
  requestId: string
): Promise<Response | null> {
  if (!apiKey) {
    Logger.warn('Missing API key', { requestId });
    return createErrorResponse(401, requestId, 'Unauthorized', 'API key required');
  }

  try {
    const isValid = await env.API_KEYS.get(apiKey);
    if (!isValid) {
      Logger.warn('Invalid API key', { requestId, apiKey });
      return createErrorResponse(401, requestId, 'Unauthorized', 'Invalid API key');
    }
    return null;
  } catch (error) {
    Logger.error('API key validation failed', { requestId, apiKey, error });
    return createErrorResponse(500, requestId, 'Internal Server Error');
  }
}
