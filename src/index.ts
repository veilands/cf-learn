addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/favicon.ico') {
    return handleFaviconRequest();
  }
  if (url.pathname === '/time') {
    return handleTimeRequest();
  }
  if (url.pathname === '/date') {
    return handleDateRequest();
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

async function handleFaviconRequest(): Promise<Response> {
  const base64Favicon = "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";
  const faviconBinary = Uint8Array.from(atob(base64Favicon), c => c.charCodeAt(0));
  return new Response(faviconBinary, {
    headers: { 'content-type': 'image/png' },
  });
}

function handleDateRequest(): Response {
  const currentDate = new Date().toLocaleDateString();
  return new Response(currentDate, {
    headers: { 'content-type': 'text/plain' },
  });
}
