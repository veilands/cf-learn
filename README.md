# IoT Backend Service

A high-performance IoT backend service built with Cloudflare Workers, featuring real-time data ingestion, rate limiting, and health monitoring.

## Features

- **Real-time Data Ingestion**: Collect IoT device measurements with InfluxDB integration
- **Rate Limiting**: Sliding window rate limiting (100 requests/minute per API key)
- **Health Monitoring**: Real-time health checks for all system components
- **Metrics Collection**: Track API usage and performance metrics
- **Structured Logging**: Comprehensive logging system with request tracking
- **Authentication**: API key-based authentication
- **Error Handling**: Detailed error responses with request tracing
- **Validation**: Strict schema validation for all requests

## Architecture

Detailed architecture diagrams and documentation can be found in the [Architecture Documentation](docs/architecture.md). The diagrams cover:

- High-Level System Architecture
- Request Flow and Processing
- Rate Limiting Design
- Data Flow and Processing
- Component Interactions
- System States

## API Endpoints

### Measurement Endpoint
```http
POST /measurement
Content-Type: application/json
X-API-Key: your-api-key

{
  "device": {
    "id": "device-id",
    "type": "sensor"
  },
  "readings": {
    "temperature": 22.5,
    "humidity": 45,
    "battery_voltage": 3.7
  },
  "metadata": {
    "location": "room-1",
    "timestamp": "2025-01-05T12:00:00Z"
  }
}
```

### Metrics Endpoint
```http
GET /metrics
X-API-Key: your-api-key

Response:
{
  "timestamp": "2025-01-05T12:00:00Z",
  "version": "5.2.2",
  "status": {
    "influxdb": {
      "status": "healthy",
      "latency": 282
    },
    "kv_store": {
      "status": "healthy",
      "latency": 226
    }
  }
}
```

### Health Check
```http
GET /health
X-API-Key: your-api-key
```

### Time
```http
GET /time
X-API-Key: your-api-key
```

### Version
```http
GET /version
X-API-Key: your-api-key
```

## Rate Limiting

The API implements a sliding window rate limit:
- 100 requests per minute per API key
- Headers included in response:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when the rate limit resets
  - `Retry-After`: Present when rate limit is exceeded

## Validation

All requests are validated using strict schemas:
- Device measurements must include required fields (id, type, temperature)
- Optional fields are validated when present (humidity, battery_voltage, location, timestamp)
- No extra fields are allowed (strict mode)
- Numbers must be within valid ranges (e.g., battery_voltage between 0-5V)
- Timestamps must be valid ISO 8601 format

## Project Structure

```
/
├── src/
│   ├── handlers/           # Request handlers for each endpoint
│   ├── middleware/         # Middleware (validation, rate limiting, auth)
│   ├── services/          # Core business logic
│   │   ├── health.ts      # Health check service
│   │   ├── logger.ts      # Logging service
│   │   └── metrics.ts     # Metrics collection
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Main entry point
├── docs/                  # Documentation
├── public/                # Static assets
└── scripts/               # Utility scripts
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `wrangler.toml` file with your configuration:
   ```toml
   name = "your-worker-name"
   main = "src/index.ts"
   compatibility_date = "2023-01-01"

   kv_namespaces = [
     { binding = "API_KEYS", id = "your-kv-id" },
     { binding = "METRICS", id = "your-kv-id" }
   ]

   [vars]
   INFLUXDB_URL = "your-influxdb-url"
   INFLUXDB_ORG = "your-org"
   INFLUXDB_BUCKET = "your-bucket"
   ```
4. Add your secrets: `npx wrangler secret put INFLUXDB_TOKEN`
5. Deploy: `npx wrangler deploy`

## Testing

Run the provided test suite:
```bash
npm test
```

## Monitoring

Monitor your worker's health and performance:
1. Check the `/metrics` endpoint for real-time metrics
2. Use the `/health` endpoint for component health status
3. Review logs in Cloudflare dashboard

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit changes (this will automatically bump version)
4. Push to your fork
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
