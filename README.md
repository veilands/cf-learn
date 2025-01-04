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

##### POST /measurement
Stores IoT device measurements in InfluxDB Cloud.

Request body:
```json
{
  "device_id": "string",
  "temperature": number,
  "humidity": number,
  "timestamp": "string" (optional, ISO format)
}
```

Response:
- 201: Measurement stored successfully
- 401: Unauthorized
- 405: Method not allowed
- 500: Error storing measurement

#### Static Files

Static files are served from the `/public` directory. Current static files:
- `robots.txt` - Robots exclusion standard file
- `favicon.ico` - Website favicon

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
