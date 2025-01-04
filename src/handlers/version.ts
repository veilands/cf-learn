export function handleVersionRequest(): Response {
  return new Response('4.0.1', {
    headers: { 'Content-Type': 'text/plain' }
  });
}
