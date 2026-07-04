import { register } from '@/lib/observability/metrics';
import { timingSafeEqual, createHash } from 'node:crypto';

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

function tokensMatch(expectedToken: string, providedToken: string): boolean {
  return timingSafeEqual(hashToken(expectedToken), hashToken(providedToken));
}

export async function GET(request: Request): Promise<Response> {
  const expectedToken = process.env.METRICS_AUTH_TOKEN;
  if (!expectedToken) {
    return new Response('Service unavailable', { status: 503 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!tokensMatch(expectedToken, providedToken)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
    });
  }

  const metrics = await register.metrics();
  return new Response(metrics, {
    status: 200,
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
