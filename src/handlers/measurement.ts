import { Env, Measurement } from '../types';
import { recordMetric } from '../services/metrics';
import Logger from '../services/logger';

export async function handleMeasurementRequest(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  try {
    Logger.info('Processing measurement request', { requestId });

    if (request.method !== 'POST') {
      Logger.warn('Invalid method for measurement endpoint', { 
        requestId,
        method: request.method 
      });

      return new Response(
        JSON.stringify({
          error: 'Method Not Allowed',
          message: 'Only POST method is allowed for this endpoint'
        }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const measurement = await request.json() as Measurement;
    Logger.debug('Received measurement data', { requestId, measurement });
    
    // Validate measurement data
    if (!measurement.device?.id || !measurement.readings?.temperature) {
      Logger.warn('Invalid measurement data', { 
        requestId,
        measurement,
        missing: {
          deviceId: !measurement.device?.id,
          temperature: !measurement.readings?.temperature
        }
      });

      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid measurement data. Required fields: device.id, readings.temperature'
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Add timestamp if not provided
    if (!measurement.metadata?.timestamp) {
      measurement.metadata = {
        ...measurement.metadata,
        timestamp: new Date().toISOString()
      };
    }

    // Construct InfluxDB line protocol
    const point = `temperature,device_id=${measurement.device.id},device_type=${measurement.device.type} ` +
                 `value=${measurement.readings.temperature},humidity=${measurement.readings.humidity || 0} ` +
                 `${Date.parse(measurement.metadata.timestamp)}000000`;

    Logger.debug('Writing to InfluxDB', {
      requestId,
      url: `${env.INFLUXDB_URL}/api/v2/write`,
      point,
      timestamp: measurement.metadata.timestamp
    });

    const response = await fetch(
      `${env.INFLUXDB_URL}/api/v2/write?org=${env.INFLUXDB_ORG}&bucket=${env.INFLUXDB_BUCKET}&precision=ns`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${env.INFLUXDB_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: point
      }
    );

    if (!response.ok) {
      const text = await response.text();
      Logger.error('InfluxDB write failed', new Error(text), {
        requestId,
        status: response.status,
        point
      });
      throw new Error(`InfluxDB write failed: ${response.status} - ${text}`);
    }

    const duration = Date.now() - start;
    const statusCode = 201;

    Logger.request('POST', '/measurement', statusCode, duration, {
      requestId,
      deviceId: measurement.device.id,
      deviceType: measurement.device.type
    });

    await recordMetric(env, '/measurement', statusCode, duration);

    return new Response(
      JSON.stringify({
        message: 'Measurement recorded',
        timestamp: measurement.metadata.timestamp,
        requestId
      }),
      { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    const duration = Date.now() - start;
    const statusCode = 500;

    Logger.error('Measurement handler error', error as Error, { requestId });
    
    await recordMetric(env, '/measurement', statusCode, duration);
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }),
      { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
