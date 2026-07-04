import type { User } from '@supabase/supabase-js';
import type { AuditEvent } from './audit';

export function getSessionTenantId(user: User | null | undefined): string | null {
  if (!user) return null;
  const tenantId = user.app_metadata?.tenant_id;
  return typeof tenantId === 'string' ? tenantId : null;
}

export function getRequestTenantId(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return url.searchParams.get('tenant_id');
  } catch {
    return null;
  }
}

export function getBodyTenantId(body: Record<string, unknown>): string | null {
  const tenantId = body.tenant_id;
  return typeof tenantId === 'string' ? tenantId : null;
}

export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? undefined;
}

export const ANONYMOUS_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export function createTenantProbeEvent(
  user: User,
  attemptedTenantId: string,
  endpoint: string,
  correlationId?: string | null
): AuditEvent {
  return {
    actor: { user_id: user.id, tenant_id: getSessionTenantId(user) ?? ANONYMOUS_TENANT_ID },
    action: 'tenant_isolation.probe_attempted',
    resource: endpoint,
    result: 'blocked',
    correlation_id: correlationId ?? undefined,
    severity: 'WARNING',
    details: { attempted_tenant_id: attemptedTenantId },
  };
}

export function createAccessDeniedEvent(
  endpoint: string,
  correlationId?: string | null,
  ip?: string
): AuditEvent {
  return {
    actor: { user_id: 'anonymous', tenant_id: ANONYMOUS_TENANT_ID },
    action: 'auth.access_denied',
    resource: endpoint,
    result: 'denied',
    correlation_id: correlationId ?? undefined,
    severity: 'WARNING',
    ...(ip ? { ip } : {}),
    details: {},
  };
}
