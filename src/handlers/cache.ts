import { Env } from '../types';
import { validateHttpMethod, validateApiKey } from '../middleware/validation';
import { Logger } from '../services/logger';

// List of endpoints that can be purged
const PURGEABLE_ENDPOINTS = [
  '/version',
  '/health',
  '/metrics'
];

export async function handleCachePurgeRequest(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    // Validate method
    const methodError = validateHttpMethod(request, ['POST'], requestId);
    if (methodError) return methodError;

    // Validate API key
    const apiKeyError = await validateApiKey(request, env);
    if (apiKeyError) return apiKeyError;

    // Check if we have a request body
    const contentType = request.headers.get('content-type');
    let path: string | undefined;

    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await request.json();
        path = body.path;
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON body',
          requestId
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (path) {
      // Validate the path is allowed to be purged
      if (!PURGEABLE_ENDPOINTS.includes(path)) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: `Path ${path} is not allowed to be purged. Allowed paths: ${PURGEABLE_ENDPOINTS.join(', ')}`,
          requestId
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Purge specific endpoint cache
      const cacheKey = `cache:${path}`;
      await env.METRICS.delete(cacheKey);

      Logger.info('Cache purged for endpoint', { requestId, path });

      return new Response(JSON.stringify({
        message: `Cache purged for endpoint: ${path}`,
        requestId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Purge all cache
      let purged = 0;
      for (const endpoint of PURGEABLE_ENDPOINTS) {
        const cacheKey = `cache:${endpoint}`;
        await env.METRICS.delete(cacheKey);
        purged++;
      }

      Logger.info('All cache purged', { requestId, purgedCount: purged });

      return new Response(JSON.stringify({
        message: `All cache purged (${purged} endpoints)`,
        requestId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    Logger.error('Failed to purge cache', { requestId, error });
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to purge cache',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// List of endpoints that should be warmed
const WARM_ENDPOINTS = [
  '/version', // Most stable endpoint
  '/health',  // Quick health check
  '/metrics'  // System metrics
];

// Maximum time to wait for each endpoint warming
const WARM_TIMEOUT_MS = 10000; // 10 seconds as per guidelines

async function warmEndpoint(endpoint: string, baseUrl: string, apiKey: string, requestId: string): Promise<{
  endpoint: string;
  success: boolean;
  status?: number;
  statusText?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const url = new URL(endpoint, baseUrl).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WARM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'CloudflareWorker/CacheWarmer',
          'cf-worker': '1'  // Add this header to identify subrequests
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const success = response.ok;
      if (!success) {
        Logger.warn('Cache warming failed for endpoint', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          requestId
        });
      }

      return {
        endpoint,
        success,
        status: response.status,
        statusText: response.statusText,
        cached: response.headers.get('x-cache-hit') === 'true'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          endpoint,
          success: false,
          error: `Request timed out after ${WARM_TIMEOUT_MS}ms`
        };
      }
      throw error;
    }
  } catch (error) {
    Logger.error('Error warming cache for endpoint', {
      endpoint,
      error,
      requestId
    });
    return {
      endpoint,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function handleCacheWarmRequest(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    // Validate method
    const methodError = validateHttpMethod(request, ['POST'], requestId);
    if (methodError) return methodError;

    // Validate API key
    const apiKeyError = await validateApiKey(request, env);
    if (apiKeyError) return apiKeyError;

    // Get the base URL from the request
    const baseUrl = new URL(request.url).origin;
    const apiKey = request.headers.get('x-api-key') || '';

    // Warm up each endpoint
    const warmedEndpoints = await Promise.all(
      WARM_ENDPOINTS.map(endpoint => 
        warmEndpoint(endpoint, baseUrl, apiKey, requestId)
      )
    );

    const allSuccess = warmedEndpoints.every(endpoint => endpoint.success);
    const status = allSuccess ? 200 : 207; // Use 207 Multi-Status if some endpoints failed

    Logger.info('Cache warming completed', {
      endpoints: warmedEndpoints,
      allSuccess,
      requestId
    });

    return new Response(JSON.stringify({
      success: allSuccess,
      warmedEndpoints,
      requestId
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    Logger.error('Error warming cache', { error, requestId });
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
