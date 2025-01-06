import { Logger } from './logger';

export class ErrorService {
  /**
   * Handle uncaught exceptions with Cloudflare-specific context
   */
  static handleUncaughtException(error: Error, request: Request): Response {
    const errorId = crypto.randomUUID();
    
    Logger.error('Uncaught exception', {
      error,
      errorId,
      request,
      cf: request.cf
    });

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        errorId,
        ray: request.headers.get('cf-ray')
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Id': errorId
        }
      }
    );
  }

  /**
   * Create a response for rate limiting errors
   */
  static createRateLimitResponse(request: Request, retryAfter: number): Response {
    const errorId = crypto.randomUUID();
    
    Logger.warn('Rate limit exceeded', {
      errorId,
      request,
      cf: request.cf,
      retryAfter
    });

    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        errorId,
        retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-Error-Id': errorId
        }
      }
    );
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    message: string,
    details: any,
    request: Request
  ): Response {
    const errorId = crypto.randomUUID();
    
    Logger.warn('Validation error', {
      errorId,
      message,
      details,
      request,
      cf: request.cf
    });

    return new Response(
      JSON.stringify({
        error: 'Validation Error',
        message,
        details,
        errorId
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Id': errorId
        }
      }
    );
  }
}
