import { Env } from '../types';
import { HeadersService } from '../services/headers';

export function withSecurityHeaders(
  handler: (request: Request, env: Env) => Promise<Response>
): (request: Request, env: Env) => Promise<Response> {
  return async (request: Request, env: Env) => {
    const response = await handler(request, env);
    const newHeaders = new Headers(response.headers);
    
    // Add security headers
    HeadersService.addSecurityHeaders(newHeaders);

    // Add CORS headers if needed
    const origin = request.headers.get('Origin');
    if (origin) {
      HeadersService.addCorsHeaders(newHeaders, origin);
    }

    // Add debug headers in development
    HeadersService.addDebugHeaders(newHeaders, request);

    // Add performance headers
    HeadersService.addPerformanceHeaders(newHeaders);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };
}
