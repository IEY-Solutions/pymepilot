import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';
import { apiRateLimiter } from '@/lib/rate-limit';
import { recordRateLimitRequest } from '@/lib/observability/metrics.edge';
import { getLogger } from '@/lib/observability/logger';
import { emitAudit } from '@/lib/audit';
import { getSessionTenantId, ANONYMOUS_TENANT_ID } from '@/lib/api-security';

const CORRELATION_HEADER = 'X-Correlation-ID';

function isValidUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const existing = request.headers.get(CORRELATION_HEADER.toLowerCase()) ?? request.headers.get(CORRELATION_HEADER);
  const correlationId = existing && isValidUuidV4(existing) ? existing : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const pathname = request.nextUrl?.pathname ?? '';
  if (pathname.startsWith('/api/')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const requestIp = (request as unknown as { ip?: string }).ip;
    const key = user?.id ?? requestIp ?? 'anonymous';
    const tenantId = (user?.app_metadata?.tenant_id as string | undefined) ?? 'anonymous';
    const result = apiRateLimiter.check(key, pathname);

    recordRateLimitRequest(tenantId, pathname, result.allowed ? 'allowed' : 'blocked');

    if (!result.allowed) {
      getLogger().warn(
        {
          event: 'rate_limit.exceeded',
          tenant_id: tenantId,
          endpoint: pathname,
          limit: result.limit,
          window: result.windowMs,
          correlation_id: correlationId,
        },
        'Rate limit exceeded'
      );

      await emitAudit(supabase, {
        actor: {
          user_id: user?.id ?? 'anonymous',
          tenant_id: getSessionTenantId(user) ?? ANONYMOUS_TENANT_ID,
        },
        action: 'rate_limit.exceeded',
        resource: pathname,
        result: 'denied',
        severity: 'WARNING',
        correlation_id: correlationId,
        ip: requestIp,
      });

      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: `Demasiadas solicitudes. Esperá ${result.retryAfterSeconds} segundos.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSeconds),
            [CORRELATION_HEADER]: correlationId,
          },
        }
      );
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(CORRELATION_HEADER, correlationId);
    return response;
  }

  const response = await updateSession(request, requestHeaders);
  response.headers.set(CORRELATION_HEADER, correlationId);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
