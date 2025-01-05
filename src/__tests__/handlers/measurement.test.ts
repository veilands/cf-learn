import { handleMeasurementRequest } from '../../handlers/measurement';
import { mockEnv, mockKV } from '../setup';

describe('Measurement Handler', () => {
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

  it('should handle valid measurement request', async () => {
    const request = new Request('https://example.com/measurement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'valid-key'
      },
      body: JSON.stringify(validMeasurement)
    });

    mockKV.get.mockResolvedValueOnce('true'); // Valid API key
    global.fetch = jest.fn().mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const response = await handleMeasurementRequest(request, mockEnv);
    expect(response.status).toBe(201);
    
    const body = await response.json();
    expect(body).toEqual({ success: true });
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

    const request = new Request('https://example.com/measurement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'valid-key'
      },
      body: JSON.stringify(invalidMeasurement)
    });

    mockKV.get.mockResolvedValueOnce('true'); // Valid API key

    const response = await handleMeasurementRequest(request, mockEnv);
    expect(response.status).toBe(400);
    
    const body = await response.json();
    expect(body.error).toBe('Bad Request');
  });

  it('should reject requests with invalid API key', async () => {
    const request = new Request('https://example.com/measurement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'invalid-key'
      },
      body: JSON.stringify(validMeasurement)
    });

    mockKV.get.mockResolvedValueOnce(null); // Invalid API key

    const response = await handleMeasurementRequest(request, mockEnv);
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });
});
