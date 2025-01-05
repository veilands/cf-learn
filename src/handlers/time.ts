import { validateHttpMethod } from '../middleware/validation';

export async function handleTimeRequest(request: Request): Promise<Response> {
  const methodError = validateHttpMethod(request, ['GET']);
  if (methodError) return methodError;

  return new Response(new Date().toLocaleTimeString(), {
    headers: { 
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

export async function handleDateRequest(request: Request): Promise<Response> {
  const methodError = validateHttpMethod(request, ['GET']);
  if (methodError) return methodError;

  return new Response(new Date().toLocaleDateString(), {
    headers: { 
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}
