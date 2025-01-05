interface RateLimitInfo {
  requests: number;
  resetTime: number;
}

interface RateLimitConfig {
  limit: number;
  window: number;
}

export class RateLimiter {
  private state: DurableObjectState;
  private config: RateLimitConfig;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.config = {
      limit: 100,
      window: 60 // 1 minute
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    if (action === 'increment') {
      return this.handleIncrement();
    }

    return new Response('Not Found', { status: 404 });
  }

  private async getRateLimitInfo(): Promise<RateLimitInfo> {
    const info = await this.state.storage.get<RateLimitInfo>('rateLimitInfo');
    const now = Date.now();
    
    if (!info || now > info.resetTime) {
      const newInfo = {
        requests: 0,
        resetTime: now + this.config.window * 1000
      };
      await this.state.storage.delete('rateLimitInfo');
      await this.state.storage.put('rateLimitInfo', newInfo);
      return newInfo;
    }

    return info;
  }

  private async handleIncrement(): Promise<Response> {
    // Get rate limit info and check if we need to reset
    let info = await this.getRateLimitInfo();
    const now = Date.now();
    
    if (now > info.resetTime) {
      info = {
        requests: 0,
        resetTime: now + this.config.window * 1000
      };
      await this.state.storage.delete('rateLimitInfo');
      await this.state.storage.put('rateLimitInfo', info);
    }

    // Check if we're over the limit
    if (info.requests >= this.config.limit) {
      const headers = this.getRateLimitHeaders(0, info.resetTime);
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Rate limit of ${this.config.limit} requests per minute exceeded`,
        resetTime: new Date(info.resetTime).toISOString(),
        headers
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }

    // Increment request count
    info.requests++;
    await this.state.storage.put('rateLimitInfo', info);

    const remaining = Math.max(0, this.config.limit - info.requests);
    const headers = this.getRateLimitHeaders(remaining, info.resetTime);

    return new Response(JSON.stringify({
      allowed: true,
      remaining,
      resetTime: new Date(info.resetTime).toISOString(),
      headers
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }

  private getRateLimitHeaders(remaining: number, resetTime: number): HeadersInit {
    return {
      'X-RateLimit-Limit': this.config.limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    };
  }
}
