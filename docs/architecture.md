# Architecture Documentation

## System Overview

```mermaid
graph TD
    Device[IoT Device] -->|POST /measurement| Worker[Cloudflare Worker]
    Monitor[Monitoring System] -->|GET /metrics| Worker
    Worker -->|Store| KV[Cloudflare KV]
    Worker -->|Write| InfluxDB[InfluxDB]
    Worker -->|Validate| Auth[API Key Auth]
    Worker -->|Rate Limit| RateLimit[Rate Limiter]
```

## Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant Auth
    participant RateLimit
    participant Validation
    participant KV
    participant InfluxDB

    Client->>Worker: Request with API Key
    Worker->>Auth: Validate API Key
    Auth->>KV: Check Key
    KV-->>Auth: Key Valid
    Auth-->>Worker: Authorized
    Worker->>RateLimit: Check Rate Limit
    RateLimit->>KV: Get/Update Counter
    KV-->>RateLimit: Counter Updated
    RateLimit-->>Worker: Within Limits
    Worker->>Validation: Validate Request
    Validation-->>Worker: Valid
    Worker->>InfluxDB: Store Data
    InfluxDB-->>Worker: Success
    Worker-->>Client: Response
```

## Component Interactions

### API Key Authentication
- Stored in Cloudflare KV
- Validated on every request
- Rate limits tracked per key

### Rate Limiting
- Sliding window implementation
- 100 requests per minute per API key
- Counter stored in KV
- Headers included in response

### Validation
- Schema-based validation using Zod
- Required fields enforced
- Type checking
- Range validation for numeric values

### Data Storage
- Measurements stored in InfluxDB
- Metrics stored in KV
- Health status cached in KV

## Testing Strategy

```mermaid
graph TD
    Deploy[Deploy to Workers] -->|Automatic| Test[Run E2E Tests]
    Test -->|Test API Key Auth| Auth[Authentication Tests]
    Test -->|Test Rate Limiting| Rate[Rate Limit Tests]
    Test -->|Test Measurements| Data[Data Validation Tests]
    Test -->|Test Metrics| Health[Health Check Tests]
    Auth -->|Success/Fail| Report[Test Report]
    Rate -->|Success/Fail| Report
    Data -->|Success/Fail| Report
    Health -->|Success/Fail| Report
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
   - Error handling

### CI/CD Pipeline
1. On push to main:
   - Deploy to Cloudflare Workers
   - Run E2E tests
   - Generate coverage report
   - Upload results to Codecov

## Error Handling

```mermaid
graph TD
    Error[Error Occurs] -->|4xx| Client[Client Error]
    Error -->|5xx| Server[Server Error]
    Client -->|401| Auth[Unauthorized]
    Client -->|429| Rate[Rate Limited]
    Client -->|400| Validation[Bad Request]
    Server -->|500| Internal[Internal Error]
    Server -->|503| Service[Service Unavailable]
    Auth -->|Log| Logger[Error Logger]
    Rate -->|Log| Logger
    Validation -->|Log| Logger
    Internal -->|Log| Logger
    Service -->|Log| Logger
```

### Error Types
- 400: Bad Request (Invalid data)
- 401: Unauthorized (Invalid API key)
- 429: Too Many Requests (Rate limit exceeded)
- 500: Internal Server Error
- 503: Service Unavailable (InfluxDB down)

## Version Management

```mermaid
graph LR
    Commit[Git Commit] -->|Parse Message| Type[Commit Type]
    Type -->|fix:| Patch[Patch Version]
    Type -->|feat:| Minor[Minor Version]
    Type -->|BREAKING| Major[Major Version]
    Patch -->|Auto Increment| Version[New Version]
    Minor -->|Auto Increment| Version
    Major -->|Auto Increment| Version
    Version -->|Update| Package[package.json]
    Version -->|Deploy| Worker[Worker]
```

### Version Rules
- Patch (0.0.x): Bug fixes and minor changes
- Minor (0.x.0): New features
- Major (x.0.0): Breaking changes
