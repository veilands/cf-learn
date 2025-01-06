import { Env } from '../types';

export async function validateApiKey(request: Request, env: Env): Promise<Response | null> {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'API key required'
    }), {
      status: 401,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }

  try {
    const validKey = await env.API_KEYS.get(apiKey);
    if (!validKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid API key'
      }), {
        status: 401,
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
    }

    return null;
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to validate API key'
    }), {
      status: 500,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}
