import { Env } from '../types';
import { Logger } from '../services/logger';

export interface CacheConfig {
  cacheDuration: number;  // in seconds
  varyByHeaders?: string[];
  cacheBypass?: string;
  operationTimeout?: number; // milliseconds
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  cacheDuration: 60,  // 1 minute default
  varyByHeaders: ['accept', 'accept-encoding'],
  cacheBypass: 'no-cache',
  operationTimeout: 3000 // 3 seconds default timeout
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms: ${errorMessage}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

export async function getCachedResponse(
  request: Request,
  env: Env,
  config: Partial<CacheConfig> = {}
): Promise<Response | null> {
  const mergedConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
  const { cacheDuration, varyByHeaders = [], cacheBypass, operationTimeout } = mergedConfig;

  // Check for cache bypass
  if (cacheBypass && request.headers.get('cache-control')?.includes(cacheBypass)) {
    return null;
  }

  // Generate cache key
  const url = new URL(request.url);
  const headerValues = varyByHeaders.map(header => request.headers.get(header) || '');
  const cacheKey = `cache:${url.pathname}:${headerValues.join(':')}`;

  try {
    const cachedResponse = await withTimeout(
      env.METRICS.get(cacheKey),
      operationTimeout!,
      'Cache retrieval timeout'
    );
    
    if (cachedResponse) {
      const { body, init } = JSON.parse(cachedResponse);
      const headers = new Headers(init.headers);
      headers.set('X-Cache', 'HIT');
      
      // Ensure Cache-Control header is preserved
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', `public, max-age=${cacheDuration}`);
      }

      return new Response(body, {
        ...init,
        headers
      });
    }
  } catch (error) {
    Logger.warn('Cache retrieval failed', {
      error,
      data: { url: url.pathname }
    });
  }

  return null;
}

export async function cacheResponse(
  response: Response,
  request: Request,
  env: Env,
  config: Partial<CacheConfig> = {}
): Promise<Response> {
  const mergedConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
  const { cacheDuration, varyByHeaders = [], cacheBypass, operationTimeout } = mergedConfig;

  // Don't cache if bypass header is present
  if (cacheBypass && request.headers.get('cache-control')?.includes(cacheBypass)) {
    return response;
  }

  // Don't cache non-successful responses
  if (!response.ok) {
    return response;
  }

  try {
    const url = new URL(request.url);
    const headerValues = varyByHeaders.map(header => request.headers.get(header) || '');
    const cacheKey = `cache:${url.pathname}:${headerValues.join(':')}`;

    // Clone the response before reading its body
    const clone = response.clone();
    const body = await clone.text();
    const init = {
      status: clone.status,
      statusText: clone.statusText,
      headers: Object.fromEntries(clone.headers.entries())
    };

    // Store in KV with expiration
    await withTimeout(
      env.METRICS.put(
        cacheKey,
        JSON.stringify({ body, init }),
        { expirationTtl: cacheDuration }
      ),
      operationTimeout!,
      'Cache storage timeout'
    );

    // Add cache headers to response
    const headers = new Headers(init.headers);
    
    // If the response already has a Cache-Control header, use it
    const existingCacheControl = headers.get('Cache-Control');
    if (!existingCacheControl) {
      headers.set('Cache-Control', `public, max-age=${cacheDuration}`);
    }
    headers.set('X-Cache', 'MISS');

    return new Response(body, {
      status: init.status,
      statusText: init.statusText,
      headers
    });
  } catch (error) {
    Logger.error('Cache storage failed', {
      error,
      data: { url: request.url }
    });
    return response;
  }
}

export function withCache(
  handler: (request: Request, env: Env) => Promise<Response>,
  config: Partial<CacheConfig> = {}
): (request: Request, env: Env) => Promise<Response> {
  return async (request: Request, env: Env) => {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return handler(request, env);
    }

    const mergedConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

    try {
      const cachedResponse = await withTimeout(
        getCachedResponse(request, env, mergedConfig),
        mergedConfig.operationTimeout!,
        'Cache middleware timeout'
      );
      
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await withTimeout(
        handler(request, env),
        mergedConfig.operationTimeout!,
        'Handler execution timeout'
      );
      
      return cacheResponse(response, request, env, mergedConfig);
    } catch (error) {
      Logger.error('Cache middleware error', {
        error,
        data: { url: request.url }
      });
      // If caching fails, fall back to the original handler with timeout
      return withTimeout(
        handler(request, env),
        mergedConfig.operationTimeout!,
        'Fallback handler timeout'
      );
    }
  };
}

// KV Store caching functions
export async function getFromKVCache<T>(env: Env, cacheKey: string): Promise<T | null> {
  try {
    const cached = await env.METRICS.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    Logger.error('Error getting data from KV cache', { error, cacheKey });
    return null;
  }
}

export async function setKVCache(env: Env, cacheKey: string, data: any, ttl?: number): Promise<void> {
  try {
    const options = ttl ? { expirationTtl: ttl } : undefined;
    await env.METRICS.put(cacheKey, JSON.stringify(data), options);
  } catch (error) {
    Logger.error('Error setting data in KV cache', { error, cacheKey });
  }
}
