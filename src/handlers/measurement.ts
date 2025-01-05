import { Env, Measurement } from '../types';
import { validateHttpMethod, validateRequest, createErrorResponse, MeasurementRequestSchema, validateContentType } from '../middleware/validation';
import { recordMeasurement } from '../services/metrics';
import Logger from '../services/logger';

export async function handleMeasurementRequest(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const endpoint = '/measurement';

  try {
    Logger.info('Processing measurement request', {
      requestId,
      endpoint,
      method: request.method
    });

    // Validate HTTP method
    const methodError = validateHttpMethod(request, ['POST'], requestId);
    if (methodError) {
      Logger.warn('Invalid method for measurement endpoint', {
        requestId,
        endpoint,
        method: request.method
      });
      return methodError;
    }

    // Validate content type
    const contentTypeError = validateContentType(request, 'application/json', requestId);
    if (contentTypeError) {
      Logger.warn('Invalid content type for measurement endpoint', {
        requestId,
        endpoint,
        contentType: request.headers.get('content-type')
      });
      return contentTypeError;
    }

    // Parse and validate request body
    let measurement: Measurement;
    try {
      const body = await request.json();
      measurement = validateRequest(MeasurementRequestSchema, body, requestId);
    } catch (error) {
      Logger.warn('Invalid measurement request', {
        requestId,
        endpoint,
        error
      });
      return createErrorResponse(
        400,
        'Bad Request',
        'Invalid request body',
        requestId
      );
    }

    // Record measurement
    const result = await recordMeasurement(measurement, env, requestId);
    if (!result.success) {
      return createErrorResponse(
        500,
        'Internal Server Error',
        'Failed to record measurement',
        requestId
      );
    }

    const duration_ms = Date.now() - start;
    Logger.request({
      requestId,
      method: request.method,
      endpoint,
      status: 201,
      duration_ms,
      data: {
        device_id: measurement.device.id,
        device_type: measurement.device.type
      }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const duration_ms = Date.now() - start;
    Logger.error('Failed to process measurement', {
      requestId,
      endpoint,
      method: request.method,
      error,
      data: { duration_ms }
    });

    return createErrorResponse(
      500,
      'Internal Server Error',
      error instanceof Error ? error.message : 'Failed to process measurement',
      requestId
    );
  }
}
