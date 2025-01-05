# Architecture Documentation

## System Overview

```mermaid
graph TD
    Device[IoT Device] -->|POST /measurement| Worker[Cloudflare Worker]
    Monitor[Monitoring System] -->|GET /metrics| Worker
    Worker -->|Store| KV[Cloudflare KV]
    Worker -->|Write| InfluxDB[InfluxDB]
    Worker -->|Validate| Auth[API Key Auth]
    Worker -->|Rate Limit| RateLimit[Durable Objects]
```

## Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant Auth
    participant RateLimit
    participant Validation
    participant Cache
    participant KV
    participant InfluxDB

    Client->>Worker: Request with API Key
    Worker->>Auth: Validate API Key
    Auth->>KV: Check Key
    KV-->>Auth: Key Valid
    Auth-->>Worker: Authorized
    Worker->>RateLimit: Check Rate Limit
    RateLimit-->>Worker: Within Limits
    Worker->>Validation: Validate Request
    Validation-->>Worker: Valid
    Worker->>Cache: Check Cache
    Cache->>KV: Get Cached Data
    KV-->>Cache: Data
    alt Cache Miss
        Worker->>InfluxDB: Store/Query Data
        InfluxDB-->>Worker: Response
        Worker->>KV: Update Cache
    end
    Worker-->>Client: Response
```

## Component Interactions

### API Key Authentication
- Stored in Cloudflare KV
- Validated on every request
- Rate limits tracked per key
- Middleware-based validation

### Rate Limiting
- Durable Objects implementation
- 100 requests per minute per API key
- Globally consistent across all edge locations
- Headers included in response

### Validation
- Middleware-based validation
- Schema-based validation using Zod
- Required fields enforced
- Type checking
- Range validation for numeric values

### Caching
- Generic KV caching functions
- Cache middleware for common operations
- Configurable TTL per endpoint
- Automatic cache invalidation

### Data Storage
- Measurements stored in InfluxDB
- Metrics stored in KV
- Health status cached in KV
- Rate limit state in Durable Objects

## Testing Strategy

```mermaid
graph TD
    Deploy[Deploy to Workers] -->|Automatic| Test[Run E2E Tests]
    Test -->|Test API Key Auth| Auth[Authentication Tests]
    Test -->|Test Rate Limiting| Rate[Rate Limit Tests]
    Test -->|Test Measurements| Data[Data Validation Tests]
    Test -->|Test Metrics| Health[Health Check Tests]
    Test -->|Test Caching| Cache[Cache Tests]
    Auth -->|Success/Fail| Report[Test Report]
    Rate -->|Success/Fail| Report
    Data -->|Success/Fail| Report
    Health -->|Success/Fail| Report
    Cache -->|Success/Fail| Report
    Report -->|Upload| Coverage[Coverage Report]
```

### End-to-End Testing
1. Deploy worker to production environment
2. Run tests against live worker
3. Verify:
   - API key validation
   - Rate limiting
   - Data validation
   - Metrics collection
   - Caching behavior
   - Error handling

### CI/CD Pipeline
1. On push to main:
   - Run unit tests
   - Deploy to Cloudflare Workers
   - Run E2E tests
   - Generate coverage report
   - Upload results to Codecov

## Error Handling

### Error Categories
1. Authentication Errors (401)
2. Rate Limit Errors (429)
3. Validation Errors (400)
4. Internal Server Errors (500)

### Error Response Format
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "requestId": "Unique request identifier",
  "timestamp": "2025-01-05T21:00:42+02:00"
}
```
