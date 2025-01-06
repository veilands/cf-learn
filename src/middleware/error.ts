import { Env } from '../types';
import { ErrorService } from '../services/error';

export function withErrorHandling(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      return ErrorService.createErrorResponse(request, error);
    }
  };
}
