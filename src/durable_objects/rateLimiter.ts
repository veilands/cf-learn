import { Env, RateLimitResult } from '../types';

interface RateLimitState {
  count: number;
  reset: number;
}

interface RateLimiterConfig {
  limit: number;
  window: number;
}

export class RateLimiter {
  private state: DurableObjectState;
  private config: RateLimiterConfig;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.config = {
      limit: 100,
      window: 3600 // seconds
    };
  }

  async fetch(request: Request): Promise<Response> {
    const now = Date.now();
    const key = 'count'; // Simple key for testing

    // Get current state
    let currentState = await this.state.storage.get<RateLimitState>(key);
    if (!currentState || now >= currentState.reset) {
      currentState = {
        count: 0,
        reset: now + this.config.window * 1000
      };
    }

    // Check if rate limit is exceeded
    const allowed = currentState.count < this.config.limit;
    if (allowed) {
      currentState.count++;
      await this.state.storage.put(key, currentState);
    }

    // Return response with rate limit info
    return new Response(JSON.stringify({
      allowed,
      remaining: Math.max(0, this.config.limit - currentState.count),
      reset: currentState.reset
    }), {
      headers: new Headers({
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': this.config.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, this.config.limit - currentState.count).toString(),
        'X-RateLimit-Reset': Math.floor(currentState.reset / 1000).toString()
      })
    });
  }
}
