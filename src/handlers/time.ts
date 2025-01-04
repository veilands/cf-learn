export function handleTimeRequest(): Response {
  return new Response(new Date().toLocaleTimeString(), {
    headers: { 'Content-Type': 'text/plain' }
  });
}

export function handleDateRequest(): Response {
  return new Response(new Date().toLocaleDateString(), {
    headers: { 'Content-Type': 'text/plain' }
  });
}
