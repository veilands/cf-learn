import { Env } from '../types';
import { ErrorService } from '../services/error';

export function withErrorHandling(
  handler: (request: Request, env: Env) => Promise<Response>
): (request: Request, env: Env) => Promise<Response> {
  return async (request: Request, env: Env) => {
    try {
      return await handler(request, env);
    } catch (error) {
      return ErrorService.handleUncaughtException(error as Error, request);
    }
  };
}
