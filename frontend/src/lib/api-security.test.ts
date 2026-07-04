import { describe, it, expect } from 'vitest';
import {
  getSessionTenantId,
  getRequestTenantId,
  getBodyTenantId,
  getClientIp,
  createTenantProbeEvent,
  createAccessDeniedEvent,
} from './api-security';

function createUser(tenantId: string | null | undefined) {
  return {
    id: 'user-1',
    app_metadata: { tenant_id: tenantId },
  } as unknown as import('@supabase/supabase-js').User;
}

describe('getSessionTenantId', () => {
  it('returns the tenant_id from user app_metadata', () => {
    const user = createUser('tenant-a');
    expect(getSessionTenantId(user)).toBe('tenant-a');
  });

  it('returns null when tenant_id is missing', () => {
    const user = createUser(undefined);
    expect(getSessionTenantId(user)).toBeNull();
  });
});

describe('getRequestTenantId', () => {
  it('reads tenant_id from the query string', () => {
    const request = new Request('https://example.com/api/pipeline?tenant_id=tenant-b');
    expect(getRequestTenantId(request)).toBe('tenant-b');
  });

  it('returns null when tenant_id is absent', () => {
    const request = new Request('https://example.com/api/pipeline');
    expect(getRequestTenantId(request)).toBeNull();
  });
});

describe('getBodyTenantId', () => {
  it('reads tenant_id from a JSON body', () => {
    const body = { tenant_id: 'tenant-b', action: 'move' };
    expect(getBodyTenantId(body)).toBe('tenant-b');
  });

  it('returns null when tenant_id is absent', () => {
    expect(getBodyTenantId({ action: 'move' })).toBeNull();
  });
});

describe('getClientIp', () => {
  it('prefers the first x-forwarded-for address', () => {
    const request = new Request('https://example.com/api/pipeline', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('https://example.com/api/pipeline', {
      headers: { 'x-real-ip': '9.8.7.6' },
    });
    expect(getClientIp(request)).toBe('9.8.7.6');
  });
});

describe('createTenantProbeEvent', () => {
  it('builds a blocked probe audit event', () => {
    const user = createUser('tenant-a');
    const event = createTenantProbeEvent(user, 'tenant-b', '/api/pipeline', 'corr-1');

    expect(event).toEqual({
      actor: { user_id: 'user-1', tenant_id: 'tenant-a' },
      action: 'tenant_isolation.probe_attempted',
      resource: '/api/pipeline',
      result: 'blocked',
      correlation_id: 'corr-1',
      severity: 'WARNING',
      details: { attempted_tenant_id: 'tenant-b' },
    });
  });
});

describe('createAccessDeniedEvent', () => {
  it('builds an unauthenticated access audit event', () => {
    const event = createAccessDeniedEvent('/api/pipeline', 'corr-1', '1.2.3.4');

    expect(event).toMatchObject({
      action: 'auth.access_denied',
      resource: '/api/pipeline',
      result: 'denied',
      correlation_id: 'corr-1',
      severity: 'WARNING',
      actor: { user_id: 'anonymous', tenant_id: '00000000-0000-0000-0000-000000000000' },
      ip: '1.2.3.4',
    });
    expect(event.details).toEqual({});
  });
});
