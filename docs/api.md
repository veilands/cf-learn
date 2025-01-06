# API Documentation

## Overview

This document provides detailed information about the IoT Backend Service API endpoints, request/response formats, and data validation rules.

## Base URL

```
https://api.pasts.dev
```

## Authentication

All endpoints (except `/health`) require API key authentication using the `x-api-key` header:

```bash
curl -H "x-api-key: YOUR_API_KEY" https://api.pasts.dev/endpoint
```

## Rate Limiting

Rate limiting is implemented using Cloudflare Durable Objects:
- Limits are applied per API key
- Default limit: 100 requests per minute
- Bulk measurements count as a single request
- Rate limit headers are included in responses:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99
  X-RateLimit-Reset: 1704549600
  ```

## Endpoints

### POST /measurement

Submit a single device measurement.

#### Request Format
```json
{
  "device_name": "device-123",
  "location": "lab_room_1",
  "battery_voltage": 3.7,
  "temperature": 22.5,
  "humidity": 45.2,
  "timestamp": "2025-01-06T14:33:10Z"
}
```

#### Required Fields
- `device_name`: String - Unique identifier for the IoT device
- `location`: String - Physical location of the device
- `battery_voltage`: Number (0-5V) - Current battery voltage
- `temperature`: Number - Temperature in Celsius
- `humidity`: Number (0-100) - Relative humidity percentage

#### Optional Fields
- `timestamp`: String - ISO 8601 timestamp (auto-generated if not provided)

#### Success Response (201 Created)
```json
{
  "success": true,
  "requestId": "4b9dfb48-4445-473c-94c4-c5cd480b8023",
  "timestamp": "2025-01-06T14:33:10Z",
  "duration_ms": 192
}
```

### POST /measurements/bulk

Submit multiple measurements in a single request.

#### Request Format
```json
{
  "device_name": "device-123",
  "location": "lab_room_1",
  "measurements": [
    {
      "battery_voltage": 3.7,
      "temperature": 22.5,
      "humidity": 45.2,
      "timestamp": "2025-01-06T14:33:10Z"
    },
    {
      "battery_voltage": 3.6,
      "temperature": 22.7,
      "humidity": 45.5,
      "timestamp": "2025-01-06T14:33:20Z"
    }
  ]
}
```

#### Required Fields
Root level:
- `device_name`: String - Unique identifier for the IoT device
- `location`: String - Physical location of the device
- `measurements`: Array - Array of measurement objects (1-1000 items)

Each measurement object:
- `battery_voltage`: Number (0-5V) - Current battery voltage
- `temperature`: Number - Temperature in Celsius
- `humidity`: Number (0-100) - Relative humidity percentage
- `timestamp`: String - ISO 8601 timestamp

#### Success Response (201 Created)
```json
{
  "success": true,
  "requestId": "cadcc332-37cc-47ba-9a2b-020f67bed51f",
  "measurement_count": 2,
  "duration_ms": 63
}
```

### GET /metrics

Retrieve system metrics and statistics. Requires authentication.

#### Response Format
```json
{
  "requests": {
    "total": 1234,
    "success": 1200,
    "error": 34,
    "by_endpoint": {
      "/measurement": 800,
      "/measurements/bulk": 400,
      "/metrics": 34
    }
  },
  "performance": {
    "avg_response_time": 145.3,
    "p95_response_time": 250,
    "p99_response_time": 450,
    "by_endpoint": {
      "/measurement": {
        "avg": 120,
        "p95": 200,
        "p99": 350
      }
    }
  },
  "rate_limits": {
    "total_limited": 5,
    "by_endpoint": {
      "/measurement": 3,
      "/measurements/bulk": 2
    }
  },
  "influxdb": {
    "writes": 1234,
    "errors": 2,
    "avg_batch_size": 45.2
  },
  "system": {
    "cache_hits": 890,
    "cache_misses": 344
  },
  "geo": {
    "requests_by_country": {
      "US": 500,
      "GB": 300,
      "DE": 200
    },
    "requests_by_colo": {
      "SFO": 400,
      "LHR": 300,
      "FRA": 200
    }
  }
}
```

### GET /health

Check system health status. This endpoint does not require authentication.

#### Response Format
```json
{
  "status": "healthy",
  "version": "5.5.0",
  "timestamp": "2025-01-06T14:33:10Z",
  "dependencies": {
    "influxdb": {
      "status": "healthy",
      "latency_ms": 45
    },
    "kv_store": {
      "status": "healthy",
      "latency_ms": 12
    }
  }
}
```

### GET /version

Get the current API version. Requires authentication.

#### Response Format
```json
{
  "version": "5.5.0",
  "build": "61f60d47-88a1-4d1a-8ade-4da026e9e898",
  "timestamp": "2025-01-06T14:33:10Z"
}
```

### GET /time

Get the current server time. Does not require authentication.

#### Response Format
```json
{
  "timestamp": "2025-01-06T14:33:10Z",
  "unix_timestamp": 1704549190,
  "timezone": "UTC"
}
```

### POST /cache/purge

Purge specific endpoint data from the cache. Requires authentication.

#### Request Format
```json
{
  "path": "/version"
}
```

#### Required Fields
- `path`: String - The endpoint path to purge from cache (must be in the allowed list)

#### Success Response (200 OK)
```json
{
  "success": true,
  "requestId": "4b9dfb48-4445-473c-94c4-c5cd480b8023",
  "path": "/version",
  "timestamp": "2025-01-06T14:38:09Z"
}
```

### POST /cache/warm

Pre-warm the cache for specific endpoints. Requires authentication.

#### Request Format
```json
{
  "endpoints": ["/version", "/health"]
}
```

#### Required Fields
- `endpoints`: Array<string> - List of endpoints to warm (must be in the allowed list)

#### Success Response (200 OK)
```json
{
  "success": true,
  "requestId": "7c9dfb48-4445-473c-94c4-c5cd480b8024",
  "results": [
    {
      "endpoint": "/version",
      "success": true,
      "status": 200,
      "cached": true
    },
    {
      "endpoint": "/health",
      "success": true,
      "status": 200,
      "cached": true
    }
  ],
  "timestamp": "2025-01-06T14:38:09Z"
}
```

## Error Handling

### Error Response Format
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "requestId": "unique-request-id"
}
```

### Common Error Types

#### 400 Bad Request
- Invalid JSON format
- Missing required fields
- Field validation failures
- Bulk measurements exceed limit

#### 401 Unauthorized
- Missing API key
- Invalid API key

#### 429 Too Many Requests
- Rate limit exceeded
- Includes `Retry-After` header

#### 500 Internal Server Error
- Server-side errors
- Database connection issues

## Data Storage

### InfluxDB Schema

Measurements are stored in InfluxDB with the following structure:

Tags (indexed):
- device_name
- location

Fields:
- temperature
- humidity
- battery_voltage

Timestamp:
- Nanosecond precision
- UTC timezone

### Line Protocol Format
```
iot_measurements,device_name=device-123,location=lab_room_1 temperature=22.5,humidity=45.2,battery_voltage=3.7 1704549190000000000
```

## Best Practices

1. **Bulk Upload**
   - Use bulk upload for multiple measurements
   - Keep bulk requests under 1000 measurements
   - Include accurate timestamps for each measurement

2. **Error Handling**
   - Implement exponential backoff for rate limits
   - Store measurements locally if API is unavailable
   - Validate data before sending

3. **Performance**
   - Use bulk endpoints for batch processing
   - Include all optional fields when available
   - Compress requests for large payloads

4. **Security**
   - Rotate API keys regularly
   - Use HTTPS for all requests
   - Never share API keys in code or logs
