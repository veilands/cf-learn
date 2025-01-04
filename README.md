# Cloudflare Workers Project

This project is built using Cloudflare Workers with TypeScript support.

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn
- Cloudflare account
- Wrangler CLI (Cloudflare Workers CLI)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Login to Cloudflare (if not already logged in):
```bash
npx wrangler login
```

## Development

Start the development server:
```bash
npm run dev
```

This will start a local development server using Wrangler.

## Building

Build the project:
```bash
npm run build
```

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Project Structure

- `/src` - Source code files
- `wrangler.toml` - Cloudflare Workers configuration
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - ESLint configuration
- `.prettierrc` - Prettier configuration

## API Documentation

### Simple Backend API

A simple backend API built with Cloudflare Workers.

#### Features

- API Key Authentication using Cloudflare KV
- Static file serving from `/public` directory
- Multiple endpoints for different functionalities

#### Authentication

All endpoints require API key authentication. Include your API key in the request headers:

```
x-api-key: your-api-key
```

#### Endpoints

##### GET /time
Returns the current time in ISO format.

##### GET /date
Returns the current date in local format.

##### GET /version
Returns the current API version.

##### GET /health
Returns the API health status.

Request headers:
```
x-api-key: your-api-key
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-04T18:40:24Z"
}
```

##### POST /measurement
Stores IoT device measurements in InfluxDB Cloud.

Request headers:
```
x-api-key: your-api-key
Content-Type: application/json
```

Request body:
```json
{
  "device": {
    "id": "string",
    "type": "string"
  },
  "readings": {
    "temperature": number,
    "humidity": number
  },
  "metadata": {
    "timestamp": "string (optional, ISO format)",
    "location": "string (optional)"
  }
}
```

Response:
- 201: Measurement stored successfully
- 401: Unauthorized (missing or invalid API key)
- 405: Method not allowed
- 500: Error storing measurement

Example request:
```json
{
  "device": {
    "id": "sensor001",
    "type": "DHT22"
  },
  "readings": {
    "temperature": 23.5,
    "humidity": 65.2
  },
  "metadata": {
    "timestamp": "2025-01-04T18:40:24Z",
    "location": "living-room"
  }
}
```

#### Static Files

Static files are served from the `/public` directory. Current static files:
- `robots.txt` - Robots exclusion standard file
- `favicon.ico` - Website favicon

#### Versioning
This API follows semantic versioning (SemVer):
- Major version (X.0.0): Breaking changes
- Minor version (0.X.0): New features (backward compatible)
- Patch version (0.0.X): Bug fixes (backward compatible)

Version changes are automated based on commit messages:
- Breaking changes: `feat!:` or `BREAKING CHANGE` in commit message
- New features: `feat:` or `feature:` prefix
- Bug fixes: All other commits

#### Development

##### Prerequisites

- Node.js
- Wrangler CLI (`npm install -g wrangler`)

##### Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure Wrangler:
- Update `wrangler.toml` with your account details
- Set up KV namespace for API keys

#### Deployment

Deploy to Cloudflare Workers:
```bash
wrangler deploy
```

#### API Key Management

API keys are stored in Cloudflare KV. To add a new API key:

1. Access your Cloudflare Dashboard
2. Navigate to Workers & Pages > KV
3. Select your API_KEYS namespace
4. Add a new key-value pair where:
   - Key: Your API key
   - Value: `{"valid": true}`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run deploy` - Deploy to Cloudflare Workers
