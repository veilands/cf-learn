# IoT Backend Service

A serverless IoT backend service built with Cloudflare Workers. This service provides endpoints for device measurements and system metrics, with built-in API key authentication, rate limiting, and intelligent caching.

## Features

- 🔐 API Key Authentication
- 📊 Device Measurements Collection
- 📈 System Health Metrics
- ⚡ Rate Limiting
- 🔄 Automatic Version Updates
- 📝 Comprehensive Logging
- 🧪 End-to-End Testing
- 🚀 Intelligent Response Caching

## Architecture

```mermaid
graph TD
    Device[IoT Device] -->|POST /measurement| Worker[Cloudflare Worker]
    Monitor[Monitoring System] -->|GET /metrics| Worker
    Worker -->|Store| KV[Cloudflare KV]
    Worker -->|Write| InfluxDB[InfluxDB]
    Worker -->|Validate| Auth[API Key Auth]
    Worker -->|Rate Limit| RateLimit[Rate Limiter]
    Worker -->|Cache| Cache[Response Cache]
```

## API Endpoints

### POST /measurement

Submit device measurements.

```bash
curl -X POST https://api.example.com/measurement \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "device": {
      "id": "device-123",
      "type": "sensor"
    },
    "readings": {
      "temperature": 25.5,
      "humidity": 60
    }
  }'
```

### GET /metrics

Retrieve system metrics.

```bash
curl https://api.example.com/metrics \
  -H "x-api-key: your_api_key"
```

Response:
```json
{
  "timestamp": "2025-01-05T13:38:19Z",
  "version": "5.3.0",
  "status": {
    "influxdb": "healthy",
    "kv_store": "healthy"
  }
}
```

### GET /health

Get system health status. This endpoint is cached for 1 hour.

```bash
curl https://api.example.com/health \
  -H "x-api-key: your_api_key"
```

Response:
```json
{
  "status": "healthy",
  "version": "5.4.1",
  "timestamp": "2025-01-05T16:40:40Z"
}
```

### GET /version

Get the current API version. This endpoint is cached for 1 hour.

```bash
curl https://api.example.com/version \
  -H "x-api-key: your_api_key"
```

Response:
```text
5.4.1
```

### GET /time

Get the current server time. This endpoint is not cached.

```bash
curl https://api.example.com/time \
  -H "x-api-key: your_api_key"
```

Response:
```text
16:40:40
```

## Caching

The service implements intelligent response caching to improve performance and reduce load:

- `/health` endpoint: Cached for 1 hour
- `/version` endpoint: Cached for 1 hour
- `/metrics` endpoint: Not cached (real-time data)
- `/time` endpoint: Not cached (real-time data)
- `/measurement` endpoint: Not cached (write operation)

Cache headers in responses:
- `Cache-Control`: Indicates caching duration with `max-age`
- `X-Cache`: Shows cache status (`HIT` or `MISS`)

To bypass cache:
```bash
curl https://api.example.com/health \
  -H "x-api-key: your_api_key" \
  -H "Cache-Control: no-cache"
```

## Development

### Prerequisites

- Node.js >= 18
- npm >= 9
- Cloudflare account with Workers and KV enabled
- InfluxDB instance

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/iot-backend.git
   cd iot-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `wrangler.toml.example` to `wrangler.toml` and configure your environment variables:
   ```toml
   [vars]
   INFLUXDB_URL = "your_influxdb_url"
   INFLUXDB_ORG = "your_org"
   INFLUXDB_BUCKET = "your_bucket"
   ```

4. Add your Cloudflare API token secret:
   ```bash
   npx wrangler secret put INFLUXDB_TOKEN
   ```

### Setting up Cloudflare API Token

1. Go to [Cloudflare Dashboard > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Choose "Create Custom Token"
4. Set the following permissions:
   - Account Resources:
     - Workers Scripts: Edit
     - Workers Routes: Edit
     - Workers KV Storage: Edit
   - Zone Resources:
     - Zone Settings: Read
     - Workers Routes: Edit
     - All Zones: Edit (required for managing routes across zones)
5. Set appropriate IP Address Filtering and TTL if desired
6. Create token and copy it
7. Add the token to GitHub Secrets as `CF_API_TOKEN`

> Note: The "All Zones" permission is required to manage Workers routes across all zones in your account. Without this permission, you may see warnings about limited route management capabilities.

### Local Development Setup

1. Copy the example configuration:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

2. Update `wrangler.toml` with your values:
   - Replace KV namespace IDs
   - Update InfluxDB configuration

3. Set up secrets:
   ```bash
   npx wrangler secret put INFLUXDB_TOKEN
   ```

> Note: Never commit `wrangler.toml` to version control as it may contain sensitive information.

### Development Commands

- `npm run deploy`: Deploy to Cloudflare Workers
- `npm run test`: Deploy and run end-to-end tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Generate test coverage report
- `npm run format`: Format code with Prettier
- `npm run lint`: Lint code with ESLint
- `npm run type-check`: Check TypeScript types

### Testing

The project uses end-to-end tests that run against the deployed worker. This ensures we're testing the actual production behavior. Tests are written using Vitest and cover:

- API key validation
- Rate limiting
- Measurement submission
- Metrics retrieval
- Error handling

To run tests:
```bash
npm run test
```

### CI/CD

The project uses GitHub Actions for continuous integration and deployment:

1. On push/PR to main:
   - Deploys to Cloudflare Workers
   - Runs end-to-end tests
   - Uploads coverage reports

2. Version Management:
   - Automatic version bumping based on commit messages
   - Patch: Bug fixes and minor changes
   - Minor: New features
   - Major: Breaking changes

### GitHub Actions Setup

To enable CI/CD with GitHub Actions, you need to add these secrets to your repository:

1. Go to your repository's Settings > Secrets and variables > Actions
2. Add the following secrets:

| Secret Name | Description | How to Get It |
|------------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Create at [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) using "Edit Cloudflare Workers" template |
| `CF_API_KEYS_ID` | KV namespace ID for API keys | Found in Cloudflare Dashboard > Workers > KV |
| `CF_METRICS_ID` | KV namespace ID for metrics | Found in Cloudflare Dashboard > Workers > KV |
| `CF_ZONE_ID` | Zone ID for custom domain | Found in Cloudflare Dashboard > Domain Overview |
| `INFLUXDB_URL` | Your InfluxDB URL | From your InfluxDB setup |
| `INFLUXDB_ORG` | Your InfluxDB organization | From your InfluxDB setup |
| `INFLUXDB_BUCKET` | Your InfluxDB bucket | From your InfluxDB setup |

Required Cloudflare API Token Permissions:
- Workers Scripts: Edit
- Workers KV Storage: Edit

## License

MIT
