import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'https://simple-backend.veilands.workers.dev'; 
const API_KEY = 'my_api_key_12345';

interface MetricsResponse {
  timestamp: string;
  version: string;
  status: {
    influxdb: {
      status: string;
    };
    kv_store: {
      status: string;
    };
  };
}

interface MeasurementResponse {
  success: boolean;
  message: string;
  measurement_id: string;
}

describe('API E2E Tests', () => {
  describe('Metrics Endpoint', () => {
    it('should return metrics with valid API key', async () => {
      const response = await fetch(`${API_URL}/metrics`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json() as MetricsResponse;
      
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('status');
      expect(data.status).toHaveProperty('influxdb');
      expect(data.status).toHaveProperty('kv_store');
    });

    it('should reject requests without API key', async () => {
      const response = await fetch(`${API_URL}/metrics`);
      expect(response.status).toBe(401);
    });

    it('should include rate limit headers', async () => {
      const response = await fetch(`${API_URL}/metrics`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      
      expect(response.headers.get('x-ratelimit-limit')).toBe('100');
      expect(response.headers.get('x-ratelimit-remaining')).toBeDefined();
      expect(response.headers.get('x-ratelimit-reset')).toBeDefined();
      
      const data = await response.json() as MetricsResponse;
    });
  });

  describe('Measurement Endpoint', () => {
    const validMeasurement = {
      device: {
        id: 'test-device',
        type: 'sensor'
      },
      readings: {
        temperature: 25.5,
        humidity: 60
      }
    };

    it('should handle valid measurement', async () => {
      const response = await fetch(`${API_URL}/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(validMeasurement)
      });

      expect(response.status).toBe(201);
      const data = await response.json() as MeasurementResponse;
      expect(data).toEqual({ success: true });
    });

    it('should reject invalid measurement data', async () => {
      const invalidMeasurement = {
        device: {
          id: 'test-device'
          // Missing required type field
        },
        readings: {
          temperature: 'not-a-number' // Invalid temperature
        }
      };

      const response = await fetch(`${API_URL}/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(invalidMeasurement)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Bad Request');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await fetch(`${API_URL}/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'invalid-key'
        },
        body: JSON.stringify(validMeasurement)
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });
});
