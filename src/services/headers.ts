export class HeadersService {
  /**
   * Add security headers to response
   */
  static addSecurityHeaders(headers: Headers): void {
    // Content Security Policy
    headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self'; " +
      "img-src 'self' data:; " +
      "connect-src 'self';"
    );

    // Other security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'geolocation=(), microphone=()');
  }

  /**
   * Add cache control headers based on Cloudflare's cache configuration
   */
  static addCacheHeaders(headers: Headers, cacheDuration: number): void {
    headers.set('Cache-Control', `public, max-age=${cacheDuration}`);
    headers.set('CDN-Cache-Control', `max-age=${cacheDuration}`);
    headers.set('Cloudflare-CDN-Cache-Control', `max-age=${cacheDuration}`);
  }

  /**
   * Add performance optimization headers
   */
  static addPerformanceHeaders(headers: Headers): void {
    // Enable Early Hints
    headers.set('103-Early-Hints', 
      'link: </style.css>; rel=preload; as=style'
    );

    // Enable HTTP/2 Server Push
    headers.set('Link', 
      '</style.css>; rel=preload; as=style, ' +
      '</script.js>; rel=preload; as=script'
    );
  }

  /**
   * Add CORS headers with proper security settings
   */
  static addCorsHeaders(headers: Headers, origin: string): void {
    // Only allow specific origins
    if (this.isAllowedOrigin(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 
        'Content-Type, Authorization, x-api-key'
      );
      headers.set('Access-Control-Max-Age', '86400');
    }
  }

  /**
   * Add Cloudflare-specific debug headers in development
   */
  static addDebugHeaders(headers: Headers, request: Request): void {
    if (process.env.NODE_ENV === 'development') {
      headers.set('CF-Worker-Version', process.env.WORKERS_VERSION || 'unknown');
      headers.set('CF-Cache-Status', request.cf?.cacheStatus || 'DYNAMIC');
      headers.set('CF-Ray', request.cf?.ray || 'unknown');
      headers.set('CF-IPCountry', request.cf?.country || 'unknown');
    }
  }

  private static isAllowedOrigin(origin: string): boolean {
    const allowedOrigins = [
      'https://api.pasts.dev',
      'https://simple-backend.veilands.workers.dev'
    ];
    return allowedOrigins.includes(origin);
  }
}
