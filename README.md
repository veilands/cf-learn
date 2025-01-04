# Cloudflare Workers IoT Backend

A high-performance IoT backend built with Cloudflare Workers, featuring real-time metrics tracking, optimized data storage, and comprehensive health monitoring.

## Features

- Real-time IoT data ingestion and processing
- Advanced metrics tracking with KV store and InfluxDB
- Secure API key authentication
- Optimized performance with caching and parallel operations
- Comprehensive health monitoring
- Detailed system metrics

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Cloudflare account
- Wrangler CLI
- InfluxDB instance (for metrics storage)

## Environment Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Cloudflare:
```bash
npx wrangler login
```

3. Set up environment variables in `wrangler.toml`:
```toml
[vars]
INFLUXDB_URL = "your-influxdb-url"
INFLUXDB_TOKEN = "your-influxdb-token"
INFLUXDB_ORG = "your-org"
INFLUXDB_BUCKET = "your-bucket"

[[kv_namespaces]]
binding = "API_KEYS"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "METRICS"
id = "your-metrics-namespace-id"
```

## Development

Start local development server:
```bash
npm run dev
```

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## API Documentation

All endpoints require API key authentication via the `x-api-key` header.

### Measurement Endpoint

#### POST /measurement
Submit IoT device measurements.

Request:
```json
{
  "device": {
    "id": "device-001",
    "type": "temperature-sensor"
  },
  "readings": {
    "temperature": 22.5,
    "humidity": 45
  },
  "metadata": {
    "location": "room-1"
  }
}
```

Validation:
- Temperature: -273.15°C to 1000°C
- Humidity: 0% to 100%
- Required fields: device.id, device.type, readings.temperature

Response (201 Created):
```json
{
  "message": "Measurement recorded successfully",
  "timestamp": "2025-01-04T21:49:39.693Z"
}
```

### Health Check Endpoint

#### GET /health
Returns detailed system health status.

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-04T21:46:08.710Z",
  "version": "4.0.1",
  "dependencies": {
    "influxdb": {
      "status": "healthy",
      "latency": 44,
      "message": null
    },
    "kv_store": {
      "status": "healthy",
      "latency": 395,
      "message": null
    }
  },
  "system": {
    "memory_usage": {
      "total": 536870912,
      "used": 134217728,
      "free": 402653184
    }
  }
}
```

Status Codes:
- 200: System healthy/degraded
- 503: System unhealthy
- 401: Unauthorized

Health Status Criteria:
- Healthy: All systems normal
- Degraded: High latency or resource usage
- Unhealthy: Critical system failure

### Metrics Endpoint

#### GET /metrics
Returns detailed system metrics with performance data.

Response:
```json
{
  "timestamp": "2025-01-04T21:54:48.441Z",
  "version": "4.0.1",
  "system": {
    "memory_usage": {
      "total": 536870912,
      "used": 134217728,
      "free": 402653184
    }
  },
  "dependencies": {
    "influxdb": {
      "status": "healthy",
      "latency": 149
    },
    "kv_store": {
      "status": "healthy",
      "latency": 411
    }
  },
  "requests": {
    "total": 20,
    "success": 9,
    "error": 11,
    "by_endpoint": {
      "/measurement": {
        "total": 11,
        "success": 3,
        "error": 8,
        "avg_latency": 0
      }
    }
  }
}
```

### Utility Endpoints

#### GET /time
Returns current time in ISO format.

#### GET /date
Returns current date in local format.

#### GET /version
Returns API version information.

## Performance Optimizations

The API includes several performance optimizations:

1. **Caching**:
   - In-memory cache for metrics (10s TTL)
   - Optimized KV store operations

2. **Parallel Operations**:
   - Concurrent metrics recording
   - Parallel data fetching

3. **Efficient Queries**:
   - Optimized InfluxDB queries
   - Batch KV operations

4. **Error Handling**:
   - Graceful degradation
   - Detailed error reporting
   - Type-safe operations

## Security

- API key authentication required for all endpoints
- Request validation and sanitization
- Secure error messages
- Rate limiting (100 requests per minute per API key)

## Rate Limiting

The API implements a sliding window rate limiting mechanism to prevent abuse and ensure fair usage.

### Configuration

- **Limit**: 100 requests per minute per API key
- **Window Size**: 60 seconds (sliding window)
- **Tracking**: Uses Cloudflare KV store for request counting
- **Reset**: Automatic reset after the window expires

### Rate Limit Headers

Every API response includes the following headers:

```
X-RateLimit-Limit: Maximum requests allowed per window
X-RateLimit-Remaining: Remaining requests in current window
X-RateLimit-Reset: Unix timestamp when the current window expires
```

### Rate Limit Exceeded Response

When rate limit is exceeded, the API returns:

- Status: `429 Too Many Requests`
- Headers:
  ```
  Content-Type: application/json
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: <timestamp>
  Retry-After: 60
  ```
- Body:
  ```json
  {
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Please try again later."
  }
  ```

### Testing Rate Limiting

You can test the rate limiting using cURL or PowerShell:

1. **Add a test API key** (if not already added):
   ```bash
   wrangler kv:key put --binding=API_KEYS "test_key_for_rate_limit" "true"
   ```

2. **Make a single request**:
   ```bash
   curl -i -X GET https://simple-backend.veilands.workers.dev/metrics \
        -H "x-api-key: test_key_for_rate_limit"
   ```
   Check the rate limit headers in the response.

3. **Test rate limiting**:
   ```powershell
   # PowerShell script to make multiple requests
   for ($i=1; $i -le 102; $i++) {
       $headers = @{'x-api-key'='test_key_for_rate_limit'}
       $response = Invoke-WebRequest -Uri 'https://simple-backend.veilands.workers.dev/metrics' `
                                   -Headers $headers -Method GET
       Write-Host $response.Headers['X-RateLimit-Remaining']
       Start-Sleep -Milliseconds 100
   }
   ```

   You should observe:
   - Rate limit counter decreasing with each request
   - 429 response when limit is exceeded
   - Counter reset after the window expires

### Implementation Details

The rate limiting uses a sliding window algorithm:

1. **Window Management**:
   - Each request is tracked in a 60-second window
   - Windows slide smoothly to prevent request spikes at boundaries

2. **Request Counting**:
   - Current window: Full weight for requests
   - Previous window: Weighted based on overlap
   - Total = current + (previous * overlap_percentage)

3. **Storage**:
   - Uses Cloudflare KV for distributed counting
   - Keys auto-expire after 2x window size
   - Format: `ratelimit:{api_key}:{window_timestamp}`

4. **Graceful Degradation**:
   - If rate limit checking fails, requests are allowed
   - Failures are logged for monitoring
   - KV store errors don't impact API availability

### Best Practices

1. **Client Implementation**:
   - Always check rate limit headers
   - Implement exponential backoff when limit exceeded
   - Use Retry-After header to schedule retries

2. **Error Handling**:
   - Handle 429 responses gracefully
   - Respect Retry-After header
   - Implement request queuing if needed

## Monitoring

The system provides comprehensive monitoring through:
- Real-time health checks
- Detailed metrics tracking
- Performance monitoring
- Error tracking
- Resource usage monitoring

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request (invalid data)
- 401: Unauthorized
- 404: Not Found
- 405: Method Not Allowed
- 500: Internal Server Error
- 503: Service Unavailable

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
