import { Env } from '../types';
import { Logger } from '../services/logger';

interface RequestLogData {
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent?: string;
  contentLength?: number;
  clientIp?: string;
  cacheStatus?: string;
  requestId: string;
}

export function withRequestLogging(
  handler: (request: Request, env: Env) => Promise<Response>
): (request: Request, env: Env) => Promise<Response> {
  return async (request: Request, env: Env) => {
    const requestId = crypto.randomUUID();
    const startTime = performance.now();
    const url = new URL(request.url);

    try {
      const response = await handler(request, env);
      const duration = performance.now() - startTime;

      const logData: RequestLogData = {
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration: Math.round(duration),
        userAgent: request.headers.get('user-agent') || undefined,
        contentLength: parseInt(response.headers.get('content-length') || '0') || undefined,
        clientIp: request.headers.get('cf-connecting-ip') || undefined,
        cacheStatus: response.headers.get('x-cache') || undefined,
        requestId
      };

      // Log at different levels based on status code
      if (response.status >= 500) {
        Logger.error('Request failed', { data: logData });
      } else if (response.status >= 400) {
        Logger.warn('Request error', { data: logData });
      } else {
        Logger.info('Request completed', { data: logData });
      }

      // Add request ID to response headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set('x-request-id', requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      const duration = performance.now() - startTime;

      Logger.error('Request failed with exception', {
        error,
        data: {
          method: request.method,
          path: url.pathname,
          duration: Math.round(duration),
          userAgent: request.headers.get('user-agent') || undefined,
          clientIp: request.headers.get('cf-connecting-ip') || undefined,
          requestId
        }
      });

      // Re-throw to let error handling middleware deal with it
      throw error;
    }
  };
}
