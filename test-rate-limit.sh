#!/bin/bash

URL="https://simple-backend.veilands.workers.dev/time"
API_KEY="my_api_key_12345"

echo "Making rapid requests to test rate limiting..."
for i in {1..5}; do
    echo -e "\nRequest $i:"
    curl -i -H "x-api-key: $API_KEY" "$URL"
    sleep 1
done
