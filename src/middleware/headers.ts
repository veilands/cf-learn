import { Env } from '../types';

export function withSecurityHeaders(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    const response = await handler(request, env, ctx);
    
    // Clone the response to add security headers
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}
