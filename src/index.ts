const API_VERSION = '1.0.0';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if the API key exists in the KV store
  const isValidKey = await API_KEYS.get(apiKey);

  if (!isValidKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  if (url.pathname === '/time') {
    return handleTimeRequest();
  }
  if (url.pathname === '/date') {
    return handleDateRequest();
  }
  if (url.pathname === '/version') {
    return handleVersionRequest();
  }
  return new Response('Hello, World!', {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleTimeRequest(): Response {
  const currentTime = new Date().toISOString();
  return new Response(currentTime, {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleDateRequest(): Response {
  const currentDate = new Date().toLocaleDateString();
  return new Response(currentDate, {
    headers: { 'content-type': 'text/plain' },
  });
}

function handleVersionRequest(): Response {
  return new Response(API_VERSION, {
    headers: { 'content-type': 'text/plain' },
  });
}
