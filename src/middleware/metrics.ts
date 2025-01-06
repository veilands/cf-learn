import { Env } from '../types';
import { recordRequestMetrics } from '../services/metrics';

export async function recordMetricsMiddleware(request: Request, response: Response, env: Env): Promise<void> {
  const url = new URL(request.url);
  const startTime = Date.now();
  
  try {
    // Get Cloudflare-specific information
    const cf = request.cf as { country?: string; colo?: string; asn?: number } | undefined;
    
    // Record request metrics
    await recordRequestMetrics(env, {
      timestamp: new Date().toISOString(),
      endpoint: url.pathname,
      status: response.status,
      duration: Date.now() - startTime,
      cf: cf ? {
        country: cf.country,
        colo: cf.colo,
        asn: cf.asn
      } : undefined
    });
  } catch (error) {
    // Log error but don't throw to avoid affecting the response
    console.error('Failed to record metrics:', error);
  }
}
