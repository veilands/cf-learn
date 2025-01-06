import { Env } from './types';
import { handleMeasurementRequest } from './handlers/measurement';
import { handleBulkMeasurementRequest } from './handlers/bulkMeasurement';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Route requests based on path
  switch (url.pathname) {
    case '/measurement':
      return handleMeasurementRequest(request, env);
    case '/measurements/bulk':
      return handleBulkMeasurementRequest(request, env);
    default:
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint not found',
        details: { path: url.pathname }
      }), {
        status: 404,
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
  }
}
