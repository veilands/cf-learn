import { Env } from '../types';
import { validateHttpMethod } from '../middleware/validation';

export async function handleTimeRequest(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const methodError = validateHttpMethod(request, ['GET'], requestId);
    if (methodError) return methodError;

    const now = new Date();
    const timezone = {
      offset: now.getTimezoneOffset() * -1, // Convert to minutes ahead of UTC
      name: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    return new Response(JSON.stringify({
      iso: now.toISOString(),
      timestamp: now.getTime(),
      timezone,
      date: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        weekday: now.getDay()
      },
      time: {
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds()
      }
    }), {
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      })
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}
