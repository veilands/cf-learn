import { Env } from '../types';
import { validateHttpMethod, validateApiKey } from '../middleware/validation';
import { withCache } from '../middleware/cache';
import versionData from '../version.json';

async function handleVersionRequestInternal(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  
  try {
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) return methodError;

    const apiKeyError = await validateApiKey(request, env);
    if (apiKeyError) return apiKeyError;

    const [major, minor, patch] = versionData.version.split('.').map(Number);

    return new Response(JSON.stringify({
      version: versionData.version,
      major,
      minor,
      patch
    }), {
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}

// Cache version endpoint for 1 hour
export const handleVersionRequest = withCache(handleVersionRequestInternal, {
  cacheDuration: 3600
});
