interface EndpointMetrics {
  total: number;
  success: number;
  error: number;
}

interface Metrics {
  [endpoint: string]: EndpointMetrics;
}

export class MetricsCounter {
  private state: DurableObjectState;
  private metrics: Metrics;
  private initialized = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.metrics = {};
  }

  private async initialize() {
    if (!this.initialized) {
      const stored = await this.state.storage.get<Metrics>('metrics');
      if (stored) {
        this.metrics = stored;
      }
      this.initialized = true;
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();
    
    const url = new URL(request.url);
    const method = request.method;

    switch (method) {
      case 'POST': {
        const { endpoint, success } = await request.json();
        await this.recordRequest(endpoint, success);
        return new Response('OK', { status: 200 });
      }
      case 'GET': {
        return new Response(JSON.stringify(this.metrics), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      default:
        return new Response('Method not allowed', { status: 405 });
    }
  }

  private async recordRequest(endpoint: string, success: boolean) {
    if (!this.metrics[endpoint]) {
      this.metrics[endpoint] = { total: 0, success: 0, error: 0 };
    }

    this.metrics[endpoint].total++;
    if (success) {
      this.metrics[endpoint].success++;
    } else {
      this.metrics[endpoint].error++;
    }

    await this.state.storage.put('metrics', this.metrics);
  }
}
