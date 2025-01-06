# Caching Implementation

This document describes the caching implementation in our IoT backend using Cloudflare's Cache API and edge caching features.

## Overview

Our caching system utilizes Cloudflare's built-in Cache API and edge caching capabilities to improve performance and reduce load on our backend services. The implementation focuses on caching responses from endpoints that serve relatively static data.

## Cache Configuration

### Cached Endpoints

Currently, the following endpoints are cached:

- `/version` - Cached for 1 hour (3600 seconds)
- `/health` - Cached for 30 seconds
- `/metrics` - Cached for 60 seconds (with conditional caching)

### Cache Key Strategy

Cache keys are generated based on:
- URL path
- Accept header
- Accept-Encoding header
- API key hash (for authenticated endpoints)
- Query parameters (where relevant)

### Cache Zones

We utilize different cache zones for different types of content:

1. **Edge Cache**
   - Closest to the user
   - Fastest response times
   - Used for static content

2. **Worker Cache**
   - Programmatic cache control
   - Custom cache keys
   - Used for dynamic content

## Cache Headers

Our responses include the following cache-related headers:

### Standard Cache Headers
- `Cache-Control: public, max-age=<duration>` - Indicates how long the response should be cached
- `ETag` - Entity tag for cache validation
- `Last-Modified` - Last modification timestamp
- `Vary` - Headers that affect caching

### Cloudflare-Specific Headers
- `CF-Cache-Status` - Cloudflare cache status (HIT, MISS, EXPIRED, REVALIDATED)
- `CF-Cache-Tags` - Custom cache tags for purging
- `CDN-Cache-Control` - CDN-specific cache control
- `Cloudflare-CDN-Cache-Control` - Cloudflare-specific cache directives

### Performance Headers
- `103-Early-Hints` - Pre-loading hints for cached resources
- `Link: </style.css>; rel=preload` - Resource hints for caching

## Cache Management

### Cache Purging

To purge a cached endpoint:

```bash
curl -X POST https://api.pasts.dev/cache/purge \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path": "/version"}'
```

#### Response Example (Success)
```json
{
  "success": true,
  "message": "Cache purged for path: /version",
  "requestId": "uuid",
  "timestamp": "2025-01-06T13:24:34Z"
}
```

#### Response Example (Invalid Path)
```json
{
  "error": "Bad Request",
  "message": "Path /invalid is not allowed to be purged. Allowed paths: /version, /health, /metrics",
  "requestId": "uuid",
  "timestamp": "2025-01-06T13:24:34Z"
}
```

### Cache Warming

Endpoints can be pre-warmed using:

```bash
curl -X POST https://api.pasts.dev/cache/warm \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"paths": ["/version", "/health"]}'
```

## Cache Validation

- Only GET requests are cached
- Only successful responses (200 OK) are cached
- Cache purging is restricted to predefined endpoints
- Cache purging requires API key authentication
- Cache keys include API key hash for security

## Performance Optimizations

1. **Edge Caching**
   - Utilize Cloudflare's global edge network
   - Automatic compression (Brotli/Gzip)
   - Smart routing to nearest edge location

2. **Cache Warming**
   - Automated cache warming after deployments
   - Periodic cache refresh for critical endpoints
   - Geographic-based cache warming

3. **Early Hints**
   - 103 Early Hints for cached resources
   - Preload critical assets
   - Reduce perceived latency

## Monitoring

### Cache Analytics

Monitor cache performance using:
- Cache hit ratio
- Cache status distribution
- Geographic cache performance
- Cache bandwidth usage

### Cache Headers Example

```http
HTTP/1.1 200 OK
Date: Mon, 06 Jan 2025 13:24:34 GMT
Cache-Control: public, max-age=3600
CF-Cache-Status: HIT
Age: 1713
Last-Modified: Mon, 06 Jan 2025 12:56:01 GMT
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
CF-Cache-Tags: v1,api,version
Vary: Accept-Encoding
103-Early-Hints: link: </style.css>; rel=preload; as=style
Link: </style.css>; rel=preload; as=style, </script.js>; rel=preload; as=script
Content-Type: application/json
```

## Best Practices

1. **Cache Duration**
   - Set appropriate TTLs based on data volatility
   - Use shorter TTLs for frequently updated data
   - Consider user requirements for data freshness

2. **Cache Keys**
   - Include relevant request parameters
   - Consider API version in cache key
   - Hash sensitive information in cache keys

3. **Security**
   - Never cache sensitive data
   - Include authentication in cache keys
   - Implement cache purging authentication

4. **Performance**
   - Use edge caching when possible
   - Implement cache warming strategies
   - Monitor cache hit ratios

5. **Headers**
   - Set appropriate Cache-Control directives
   - Include Vary header for content negotiation
   - Use ETag for cache validation
