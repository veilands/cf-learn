#!/bin/bash

BASE_URL="https://simple-backend.veilands.workers.dev"
API_KEY="my_api_key_12345"
INVALID_KEY="invalid_key_123"

echo "Testing /health endpoint (no API key required)..."
curl -i "$BASE_URL/health"
echo -e "\n"

echo "Testing /version endpoint with valid API key..."
curl -i -H "x-api-key: $API_KEY" "$BASE_URL/version"
echo -e "\n"

echo "Testing /version endpoint with invalid API key..."
curl -i -H "x-api-key: $INVALID_KEY" "$BASE_URL/version"
echo -e "\n"

echo "Testing /time endpoint..."
curl -i -H "x-api-key: $API_KEY" "$BASE_URL/time"
echo -e "\n"

echo "Testing /metrics endpoint..."
curl -i -H "x-api-key: $API_KEY" "$BASE_URL/metrics"
echo -e "\n"

echo "Testing /measurement endpoint with valid data..."
curl -i -X POST "$BASE_URL/measurement" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "device": {
      "id": "device-123",
      "type": "sensor"
    },
    "readings": {
      "temperature": 25.5,
      "humidity": 60
    }
  }'
echo -e "\n"

echo "Testing rate limiting (multiple quick requests)..."
for i in {1..5}; do
  curl -i -H "x-api-key: $API_KEY" "$BASE_URL/time"
  echo -e "\n"
  sleep 1
done
