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

##### GET /metrics
Returns detailed system metrics including memory, CPU, and uptime information.

Request headers:
```
x-api-key: your-api-key
```

Response:
```json
{
  "timestamp": "2025-01-04T18:56:30Z",
  "system": {
    "uptime": {
      "value": 3600,
      "unit": "seconds"
    },
    "memory": {
      "heap": {
        "used": {
          "value": 4194304,
          "unit": "bytes"
        },
        "total": {
          "value": 8388608,
          "unit": "bytes"
        }
      },
      "rss": {
        "value": 16777216,
        "unit": "bytes"
      }
    },
    "cpu": {
      "usage": {
        "user": {
          "value": 1000000,
          "unit": "microseconds"
        },
        "system": {
          "value": 500000,
          "unit": "microseconds"
        }
      }
    }
  }
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
- Major version (X.0.0): Breaking changes that may require client updates
- Minor version (0.X.0): New features (backward compatible)
- Patch version (0.0.X): Bug fixes and minor improvements (backward compatible)

Version changes are automated based on commit message prefixes:

##### Breaking Changes (Major Version)
```
feat!: major change
feat(scope)!: scoped major change
feat: regular change

BREAKING CHANGE: description of breaking change
```

##### New Features (Minor Version)
```
feat: add new endpoint
feat(scope): add feature to specific scope
feature: alternative prefix
```

##### Bug Fixes and Updates (Patch Version)
```
fix: bug fix
docs: documentation update
chore: maintenance
style: formatting
refactor: code restructuring
test: adding tests
```

Example commit messages:
- `feat(auth)!: require API key for all endpoints`
- `feat(metrics): add CPU usage tracking`
- `fix: correct temperature calculation`
- `docs: update API documentation`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run deploy` - Deploy to Cloudflare Workers
