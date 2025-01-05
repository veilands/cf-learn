import versionInfo from '../version.json';
import { validateHttpMethod } from '../middleware/validation';
import { withCache } from '../middleware/cache';

async function handleVersionRequestInternal(request: Request): Promise<Response> {
  const methodError = validateHttpMethod(request, ['GET']);
  if (methodError) return methodError;

  return new Response(versionInfo.version, {
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Cache version endpoint for 1 hour since it rarely changes
export const handleVersionRequest = withCache(handleVersionRequestInternal, {
  cacheDuration: 3600 // 1 hour
});
