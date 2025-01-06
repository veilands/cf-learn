# Caching Implementation

This document describes the caching implementation in our IoT backend using Cloudflare's Cache API and edge caching features.

## Overview

Our caching system utilizes Cloudflare's built-in Cache API and edge caching capabilities to improve performance and reduce load on our backend services. The implementation focuses on caching responses from endpoints that serve relatively static data.

## Cache Configuration

### Cached Endpoints

Currently, the following endpoints are cached:

- `/version` - Cached for 1 hour (3600 seconds)
  - Most stable endpoint
  - Supports cache purging
- `/metrics` - Cached for 10 seconds
  - Provides system metrics from Durable Objects
  - Short cache duration to ensure fresh data
  - Supports cache purging
- `/health` - Cached for 30 seconds
  - System health status
  - Supports cache purging

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

## Cache Management

### Cache Purging

The system supports two methods of cache purging:

#### 1. Purge All Cache (No Request Body)
Purges cache for all purgeable endpoints (`/version`, `/health`, `/metrics`):

```bash
curl -X POST https://api.pasts.dev/cache/purge \
  -H "X-API-Key: your_api_key"
```

Response:
```json
{
  "message": "All cache purged (3 endpoints)",
  "requestId": "53bf0741-a59d-46cf-be73-5fe8a66c146a"
}
```

#### 2. Purge Specific Endpoint (JSON Request Body)
Purges cache for a specific endpoint:

```bash
curl -X POST https://api.pasts.dev/cache/purge \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"path": "/health"}'
```

Response:
```json
{
  "message": "Cache purged for endpoint: /health",
  "requestId": "7d9e0532-b8f4-4c1a-9f2b-3e5d8b6a9c01"
}
```

Error Response (Invalid Path):
```json
{
  "error": "Bad Request",
  "message": "Path /invalid is not allowed to be purged. Allowed paths: /version, /health, /metrics",
  "requestId": "f09b0f58-61c7-47e8-ba52-a046a8451e9b"
}
```

## Cache Warming

Cache warming is not currently implemented as our endpoints are frequently accessed and naturally warm the cache. The short cache durations (10-30 seconds for most endpoints) also reduce the need for explicit cache warming.

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

2. **Early Hints**
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
