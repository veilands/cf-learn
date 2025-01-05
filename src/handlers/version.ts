import versionInfo from '../version.json';
import { validateHttpMethod } from '../middleware/validation';
import { withCache } from '../middleware/cache';
import { Env } from '../types';

async function handleVersionRequestInternal(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  const methodError = validateHttpMethod(request, ['GET'], requestId);
  if (methodError) return methodError;

  return new Response(versionInfo.version, {
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Cache version endpoint for 1 hour since it rarely changes
export const handleVersionRequest = withCache(handleVersionRequestInternal, {
  cacheDuration: 3600 // 1 hour
});
