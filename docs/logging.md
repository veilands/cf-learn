# Logging Implementation

This document describes the logging implementation in our IoT backend using Cloudflare Workers.

## Overview

Our logging system is designed to provide comprehensive insights into request handling, system performance, and error tracking within the Cloudflare Workers environment. It utilizes Cloudflare-specific features to enhance observability.

## Log Structure

### Standard Fields
- `level`: Log level (debug, info, warn, error)
- `message`: Log message
- `timestamp`: ISO timestamp
- `requestId`: Unique request identifier
- `duration_ms`: Request processing time

### Cloudflare-Specific Fields
- `cf.colo`: Cloudflare data center location
- `cf.country`: Request origin country
- `cf.asn`: Autonomous System Number
- `cf.tlsVersion`: TLS version used
- `cf.httpProtocol`: HTTP protocol version
- `cf.botManagement`: Bot detection information
- `cf.cacheTtl`: Cache Time-To-Live
- `cf.cacheEverything`: Cache configuration
- `cf.scrapeShield`: Scrape shield status
- `cf.apps`: Apps status
- `cf.minify`: Minification settings
- `cf.mirage`: Image optimization status
- `cf.polish`: Image Polish status

### Security Headers Logging
- `securityHeaders.csp`: Content Security Policy
- `securityHeaders.xfo`: X-Frame-Options
- `securityHeaders.xss`: X-XSS-Protection
- `securityHeaders.nosniff`: X-Content-Type-Options
- `securityHeaders.referrer`: Referrer-Policy
- `securityHeaders.permissions`: Permissions-Policy

### Performance Headers Logging
- `performanceHeaders.earlyHints`: 103 Early Hints status
- `performanceHeaders.serverPush`: HTTP/2 Server Push details
- `performanceHeaders.cacheControl`: Cache-Control directives
- `performanceHeaders.edgeTTL`: Edge caching TTL

### Request-Specific Data
- `method`: HTTP method
- `path`: Request path
- `status`: HTTP status code
- `userAgent`: Client user agent
- `contentLength`: Response size
- `clientIp`: Client IP address
- `cacheStatus`: Cache hit/miss status
- `rayId`: Cloudflare Ray ID
- `waitingTime`: Client TCP RTT

## Log Levels

1. **DEBUG** (`debug`)
   - Detailed debugging information
   - Development-specific logs
   - Cache operations details
   - Security header details
   - Performance optimization data

2. **INFO** (`info`)
   - Successful requests
   - System operations
   - Cache hits
   - Normal flow events
   - Security header changes

3. **WARN** (`warn`)
   - Client errors (4xx)
   - Rate limiting warnings
   - Cache misses
   - Performance degradation
   - Security policy violations

4. **ERROR** (`error`)
   - Server errors (5xx)
   - Unhandled exceptions
   - Critical system issues
   - Authentication failures
   - Security breaches

## Example Log Outputs

### Successful Request with Security Headers
```json
{
  "level": "info",
  "message": "Request completed",
  "timestamp": "2025-01-06T12:53:31.123Z",
  "data": {
    "method": "GET",
    "path": "/version",
    "status": 200,
    "duration": 45,
    "requestId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "rayId": "6789f1ee6c54",
    "cacheStatus": "HIT",
    "securityHeaders": {
      "csp": "default-src 'self'",
      "xfo": "DENY",
      "xss": "1; mode=block",
      "nosniff": "nosniff",
      "referrer": "strict-origin-when-cross-origin",
      "permissions": "geolocation=(), microphone=()"
    }
  },
  "cf": {
    "colo": "DFW",
    "country": "US",
    "tlsVersion": "TLSv1.3",
    "httpProtocol": "HTTP/2"
  }
}
```

### Error Response with Enhanced Context
```json
{
  "level": "error",
  "message": "Request failed",
  "timestamp": "2025-01-06T12:53:32.123Z",
  "data": {
    "method": "POST",
    "path": "/measurement",
    "status": 500,
    "duration": 123,
    "requestId": "f67890ab-cdef-4321-9876-543210fedcba",
    "rayId": "6789f1ee6c55",
    "error": {
      "type": "InternalServerError",
      "message": "Failed to process request",
      "stack": "Error: Failed to process request\n    at processRequest (/worker.js:123:45)",
      "code": "INTERNAL_ERROR"
    },
    "securityContext": {
      "apiKeyValid": true,
      "rateLimit": {
        "remaining": 95,
        "limit": 100,
        "reset": 1736103737
      }
    }
  },
  "cf": {
    "colo": "DFW",
    "country": "US",
    "tlsVersion": "TLSv1.3",
    "httpProtocol": "HTTP/2"
  }
}
```

### Security Policy Violation
```json
{
  "level": "warn",
  "message": "Security policy violation",
  "timestamp": "2025-01-06T12:53:33.123Z",
  "data": {
    "method": "GET",
    "path": "/version",
    "status": 200,
    "requestId": "abc12345-6789-def0-1234-56789abcdef0",
    "violation": {
      "type": "CSP",
      "directive": "script-src",
      "blockedURI": "https://example.com/script.js",
      "disposition": "enforce"
    }
  }
}
```

## Log Aggregation

Logs are aggregated and can be:
1. Viewed in real-time using `wrangler tail`
2. Exported to external logging systems
3. Analyzed for security patterns
4. Used for performance monitoring
5. Correlated with Cloudflare Analytics

## Best Practices

1. Always include `requestId` for request correlation
2. Log security-relevant events at appropriate levels
3. Include Cloudflare-specific context when available
4. Monitor rate limit and security policy violations
5. Use structured logging for better analysis
6. Implement log rotation and retention policies
7. Follow data privacy regulations when logging PII
