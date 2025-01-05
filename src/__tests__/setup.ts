// Mock KV store
const mockKV = {
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// Mock environment
const mockEnv = {
  API_KEYS: mockKV,
  METRICS: mockKV,
  INFLUXDB_URL: 'https://example.influxdb.com',
  INFLUXDB_ORG: 'test-org',
  INFLUXDB_BUCKET: 'test-bucket',
  INFLUXDB_TOKEN: 'test-token',
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

// Clean up after each test
afterEach(() => {
  jest.restoreAllMocks();
});

export { mockKV, mockEnv };
