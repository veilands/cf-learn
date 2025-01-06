import { Env } from '../types';
import { Logger } from './logger';

export class MetricsService {
  private static async getMetricsObject(env: Env): Promise<DurableObjectStub> {
    const id = env.METRICS_COUNTER.idFromName('global_metrics');
    return env.METRICS_COUNTER.get(id);
  }

  static async recordRequest(env: Env, endpoint: string, success: boolean): Promise<void> {
    try {
      const metricsObj = await this.getMetricsObject(env);
      await metricsObj.fetch('https://metrics.internal/record', {
        method: 'POST',
        body: JSON.stringify({ endpoint, success })
      });
    } catch (error) {
      Logger.error('Failed to record metrics', { error, endpoint });
    }
  }

  static async getMetrics(env: Env): Promise<any> {
    try {
      const metricsObj = await this.getMetricsObject(env);
      const response = await metricsObj.fetch('https://metrics.internal/metrics', {
        method: 'GET'
      });
      return response.json();
    } catch (error) {
      Logger.error('Failed to get metrics', { error });
      return {};
    }
  }
}
