import { register } from '@/lib/observability/metrics';

export async function GET(request: Request): Promise<Response> {
  const expectedToken = process.env.METRICS_AUTH_TOKEN;
  if (expectedToken) {
    const authHeader = request.headers.get('authorization') ?? '';
    const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (providedToken !== expectedToken) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer' },
      });
    }
  }

  const metrics = await register.metrics();
  return new Response(metrics, {
    status: 200,
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
