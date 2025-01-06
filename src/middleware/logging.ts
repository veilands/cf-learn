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
  rayId?: string;
  cfRay?: string;
  country?: string;
  colo?: string;
  tlsVersion?: string;
  httpProtocol?: string;
  asn?: number;
  waitingTime?: number;
}

export function withRequestLogging(
  handler: (request: Request, env: Env) => Promise<Response>
): (request: Request, env: Env) => Promise<Response> {
  return async (request: Request, env: Env) => {
    const requestId = crypto.randomUUID();
    const startTime = performance.now();
    const url = new URL(request.url);
    const waitUntil = new Promise(resolve => setTimeout(resolve, 0));

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
        cacheStatus: response.headers.get('cf-cache-status') || undefined,
        requestId,
        rayId: response.headers.get('cf-ray') || undefined,
        cfRay: request.headers.get('cf-ray') || undefined,
        country: request.cf?.country,
        colo: request.cf?.colo,
        tlsVersion: request.cf?.tlsVersion,
        httpProtocol: request.cf?.httpProtocol,
        asn: request.cf?.asn,
        waitingTime: request.cf?.clientTcpRtt
      };

      // Log at different levels based on status code
      if (response.status >= 500) {
        Logger.error('Request failed', { 
          data: logData,
          request,
          error: await response.clone().text()
        });
      } else if (response.status >= 400) {
        Logger.warn('Request error', { 
          data: logData,
          request 
        });
      } else {
        Logger.info('Request completed', { 
          data: logData,
          request
        });
      }

      // Add request ID and tracing headers to response
      const newHeaders = new Headers(response.headers);
      newHeaders.set('x-request-id', requestId);
      if (request.cf?.rayId) {
        newHeaders.set('x-ray-id', request.cf.rayId);
      }

      // Wait for logging to complete before returning
      await waitUntil;

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      const duration = performance.now() - startTime;

      Logger.error('Request failed with exception', {
        error,
        request,
        data: {
          method: request.method,
          path: url.pathname,
          duration: Math.round(duration),
          userAgent: request.headers.get('user-agent') || undefined,
          clientIp: request.headers.get('cf-connecting-ip') || undefined,
          requestId,
          rayId: request.headers.get('cf-ray') || undefined,
          country: request.cf?.country,
          colo: request.cf?.colo,
          tlsVersion: request.cf?.tlsVersion,
          httpProtocol: request.cf?.httpProtocol,
          asn: request.cf?.asn,
          waitingTime: request.cf?.clientTcpRtt
        }
      });

      // Re-throw to let error handling middleware deal with it
      throw error;
    }
  };
}
