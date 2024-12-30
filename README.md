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

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run deploy` - Deploy to Cloudflare Workers
