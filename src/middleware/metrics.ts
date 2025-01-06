import { Env } from '../types';
import { MetricsService } from '../services/metrics';
import { Logger } from '../services/logger';

export function recordMetricsMiddleware(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    const endpoint = new URL(request.url).pathname;
    let response: Response;

    try {
      response = await handler(request, env, ctx);
      const success = response.status < 400;

      // Record metrics in the background
      ctx.waitUntil(
        MetricsService.recordRequest(env, endpoint, success)
      );

      return response;
    } catch (error) {
      // Record error metrics in the background
      ctx.waitUntil(
        MetricsService.recordRequest(env, endpoint, false)
      );
      throw error;
    }
  };
}
