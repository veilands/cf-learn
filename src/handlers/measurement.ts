import { Env } from '../types';
import { validateHttpMethod, validateContentType, validateRequest, MeasurementRequestSchema } from '../middleware/validation';
import { Logger } from '../services/logger';

export async function handleMeasurementRequest(request: Request, env: Env): Promise<Response> {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Validate HTTP method
    const methodError = validateHttpMethod(request, ['POST'], requestId);
    if (methodError) return methodError;

    // Validate API key first
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'API key is required',
        requestId
      }), {
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
    }

    // Validate content type
    const contentTypeError = validateContentType(request, 'application/json', requestId);
    if (contentTypeError) return contentTypeError;

    // Parse and validate request body
    let data;
    try {
      data = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
        requestId
      }), {
        status: 400,
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
    }

    // Validate measurement data
    const validationResult = validateRequest(MeasurementRequestSchema, data, requestId);
    if (validationResult instanceof Response) {
      return validationResult;
    }

    const measurement = validationResult;

    // Store measurement in InfluxDB
    try {
      const timestamp = measurement.timestamp || new Date().toISOString();
      const tags = [
        `device_name=${sanitizeTag(measurement.device_name)}`,
        measurement.location ? `location=${sanitizeTag(measurement.location)}` : null
      ].filter(Boolean).join(',');

      const fields = [
        `temperature=${measurement.temperature}`,
        `humidity=${measurement.humidity}`,
        `battery_voltage=${measurement.battery_voltage}`
      ].join(',');

      const line = `iot_measurements,${tags} ${fields} ${new Date(timestamp).getTime() * 1000000}`;

      // Send data to InfluxDB
      const response = await fetch(`${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: line
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`InfluxDB write failed: ${error}`);
      }

      const duration = Date.now() - startTime;
      Logger.info('Measurement stored successfully', {
        requestId,
        device_name: measurement.device_name,
        duration_ms: duration,
        cf: {
          colo: request.cf?.colo,
          country: request.cf?.country,
          asn: request.cf?.asn,
          tlsVersion: request.cf?.tlsVersion,
          httpProtocol: request.cf?.httpProtocol
        }
      });

      return new Response(JSON.stringify({
        success: true,
        requestId,
        timestamp,
        duration_ms: duration
      }), {
        status: 201,
        headers: new Headers({ 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        })
      });
    } catch (error) {
      Logger.error('Failed to store measurement', { 
        requestId, 
        error,
        device_name: measurement.device_name
      });
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to store measurement',
        requestId
      }), {
        status: 500,
        headers: new Headers({ 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        })
      });
    }
  } catch (error) {
    Logger.error('Measurement handler error', { requestId, error });
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: new Headers({ 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      })
    });
  }
}

// Sanitize strings for InfluxDB line protocol
function sanitizeTag(value: string): string {
  return value
    .replace(/,/g, '\\,')
    .replace(/ /g, '\\ ')
    .replace(/=/g, '\\=')
    .replace(/"/g, '\\"');
}
