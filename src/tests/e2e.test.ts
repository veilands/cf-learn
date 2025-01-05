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

interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

interface TimeResponse {
  time: string;
}

interface VersionResponse {
  version: string;
}

describe('API E2E Tests', () => {
  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_URL}/health`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json() as HealthResponse;
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('timestamp');
      expect(data.status).toBe('healthy');
    });

    it('should be cached', async () => {
      const response = await fetch(`${API_URL}/health`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).not.toBeNull();
      expect(cacheControl).toContain('max-age=');
    });
  });

  describe('Time Endpoint', () => {
    it('should return current time', async () => {
      const response = await fetch(`${API_URL}/time`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      expect(response.status).toBe(200);
      
      const data = await response.text();
      expect(data).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should not be cached', async () => {
      const response = await fetch(`${API_URL}/time`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
      expect(cacheControl).toContain('no-cache');
    });
  });

  describe('Version Endpoint', () => {
    it('should return version info', async () => {
      const response = await fetch(`${API_URL}/version`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      expect(response.status).toBe(200);
      
      const version = await response.text();
      expect(version).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should be cached', async () => {
      const response = await fetch(`${API_URL}/version`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).not.toBeNull();
      expect(cacheControl).toContain('max-age=');
    });
  });

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
      
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('API key required');
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
          type: 'sensor'
          // Missing required id field
        },
        readings: {
          temperature: 25.5
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
      const data = await response.json() as ErrorResponse;
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
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch(`${API_URL}/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Bad Request');
      expect(data.message).toBe('Invalid request body');
    });

    it('should reject requests with wrong content type', async () => {
      const response = await fetch(`${API_URL}/measurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(validMeasurement)
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Bad Request');
      expect(data.message).toBe('Content-Type must be application/json');
    });
  });

  describe('Error Handling', () => {
    it('should handle not found routes', async () => {
      const response = await fetch(`${API_URL}/nonexistent`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      expect(response.status).toBe(404);
      
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Not Found');
    });

    it('should handle method not allowed', async () => {
      const response = await fetch(`${API_URL}/metrics`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY
        }
      });
      
      expect(response.status).toBe(405);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Method Not Allowed');
    });
  });
});
