import { Env } from '../types';
import { validateHttpMethod, validateApiKey } from '../middleware/validation';
import { Logger } from '../services/logger';

// List of endpoints that can be purged
const PURGEABLE_ENDPOINTS = [
  '/version'
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

    // Get path to purge from request body
    const body = await request.json();
    const path = body.path as string;

    if (!path) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Path is required',
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Create cache key for purging
    const baseUrl = new URL(request.url).origin;
    const urlToInvalidate = new URL(path, baseUrl).toString();

    // Create cache keys for different Accept and Accept-Encoding combinations
    const cacheKeys = [
      // JSON without encoding
      new Request(urlToInvalidate, {
        headers: {
          'Accept': 'application/json'
        }
      }),
      // JSON with gzip
      new Request(urlToInvalidate, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip'
        }
      }),
      // JSON with br (brotli)
      new Request(urlToInvalidate, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'br'
        }
      })
    ];

    // Get the cache instance
    const cache = caches.default;

    // Delete all cache variations
    const purgeResults = await Promise.all(
      cacheKeys.map(key => cache.delete(key))
    );

    const purged = purgeResults.some(result => result);

    Logger.info('Cache purge attempt', { 
      path, 
      purged,
      requestId 
    });

    return new Response(JSON.stringify({
      success: true,
      message: purged ? 
        `Cache purged for path: ${path}` : 
        `No cache entries found for path: ${path}`,
      requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    Logger.error('Error purging cache', { error, requestId });
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

// List of endpoints that should be warmed
const WARM_ENDPOINTS = [
  '/version' // Only warm version endpoint for now as it's the most stable
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
