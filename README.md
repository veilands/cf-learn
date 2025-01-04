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
    "humidity": 45
  },
  "metadata": {
    "location": "room-1"
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

### Metrics
```http
GET /metrics
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

## Project Structure

```
/
├── src/
│   ├── handlers/           # Request handlers for each endpoint
│   ├── middleware/         # Middleware (rate limiting, auth)
│   ├── services/          # Core business logic
│   │   ├── health.ts      # Health check service
│   │   ├── logger.ts      # Logging service
│   │   └── metrics.ts     # Metrics collection
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Main entry point
├── public/                # Static assets
├── scripts/               # Utility scripts
├── wrangler.toml         # Cloudflare Workers configuration
└── package.json          # Project dependencies
```

## Environment Variables

Required environment variables in `wrangler.toml`:

```toml
[vars]
JWT_SECRET = "your-secret"
ACCESS_TOKEN_EXPIRES = "1800"
REFRESH_TOKEN_EXPIRES = "2592000"
INFLUXDB_URL = "your-influxdb-url"
INFLUXDB_TOKEN = "your-influxdb-token"
INFLUXDB_ORG = "your-org"
INFLUXDB_BUCKET = "your-bucket"
```

## KV Namespaces

The service uses two KV namespaces:
- `API_KEYS`: Stores valid API keys
- `METRICS`: Stores rate limiting and usage metrics

## Logging

The service implements structured JSON logging with the following levels:
- `debug`: Detailed debugging information
- `info`: General operational information
- `warn`: Warning messages for potential issues
- `error`: Error messages with stack traces

Each log entry includes:
- Timestamp
- Log level
- Message
- Request ID (for request tracing)
- Additional context data
- Error details (for error logs)

Example log entry:
```json
{
  "level": "info",
  "message": "Processing measurement request",
  "timestamp": "2025-01-04T22:36:49.116Z",
  "requestId": "99d7cf46-0df5-48a4-a6b5-81a7f9a0eec0",
  "data": {
    "deviceId": "test-device-1",
    "deviceType": "sensor"
  }
}
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `wrangler.toml`

3. Start local development:
```bash
npm run dev
```

4. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Testing

Run tests:
```bash
npm test
```

## Error Handling

The API returns structured error responses:
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "requestId": "unique-request-id"
}
```

Common HTTP status codes:
- `201`: Resource created successfully
- `400`: Bad request (invalid input)
- `401`: Unauthorized (invalid API key)
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error

## Security

- API key authentication required for all endpoints
- Rate limiting prevents abuse
- Sensitive data stored in KV namespaces
- HTTPS enforced for all requests
- API keys must be sent via `X-API-Key` header

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
