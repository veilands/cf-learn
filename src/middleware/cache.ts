import { Env } from '../types';
import { Logger } from '../services/logger';

export interface CacheConfig {
  cacheDuration: number;  // in seconds
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  cacheDuration: 3600  // 1 hour default
};

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
    const cache = caches.default;
    const cacheKey = new Request(request.url, {
      method: 'GET',
      headers: new Headers({
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Encoding': request.headers.get('Accept-Encoding') || ''
      })
    });

    try {
      // Try to get from cache
      let response = await cache.match(cacheKey);

      if (response) {
        // Add cache hit headers
        const headers = new Headers(response.headers);
        headers.set('X-Cache', 'HIT');
        headers.set('X-Cache-Hit', 'true');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      // Get fresh response
      response = await handler(request, env);

      if (response.ok) {
        // Prepare response for caching
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', `public, max-age=${mergedConfig.cacheDuration}`);
        headers.set('X-Cache', 'MISS');
        headers.set('X-Cache-Hit', 'false');

        const cachedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });

        // Store in cache
        await cache.put(cacheKey, cachedResponse.clone());
        return cachedResponse;
      }

      return response;
    } catch (error) {
      Logger.error('Cache error', { error });
      return handler(request, env);
    }
  };
}
