import { describe, it, expect, vi } from 'vitest';
import { emitAudit, hashIp } from './audit';

function createMockClient() {
  const insertCalls: unknown[] = [];
  const mockClient = {
    from: vi.fn(() => ({
      insert: vi.fn((row: unknown) => {
        insertCalls.push(row);
        return { error: null };
      }),
    })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
  return { mockClient, insertCalls };
}

describe('emitAudit', () => {
  it('inserts an audit event with hashed ip', async () => {
    const { mockClient, insertCalls } = createMockClient();
    const event = {
      actor: { user_id: 'user-1', tenant_id: 'tenant-1' },
      action: 'auth.access_denied',
      resource: '/api/pipeline',
      result: 'denied',
      correlation_id: 'corr-1',
      severity: 'WARNING' as const,
      ip: '192.168.1.1',
    };

    await emitAudit(mockClient, event, { salt: 'test-salt' });

    expect(mockClient.from).toHaveBeenCalledWith('audit_log');
    expect(insertCalls.length).toBe(1);
    const row = insertCalls[0] as Record<string, unknown>;
    expect(row.actor_user_id).toBe('user-1');
    expect(row.actor_tenant_id).toBe('tenant-1');
    expect(row.action).toBe('auth.access_denied');
    expect(row.resource).toBe('/api/pipeline');
    expect(row.result).toBe('denied');
    expect(row.correlation_id).toBe('corr-1');
    expect(row.severity).toBe('WARNING');
    expect(row.ip_hash).toBe(await hashIp('192.168.1.1', 'test-salt'));
    expect(row.ip_hash).not.toContain('192.168');
  });

  it('omits ip_hash when no ip is provided', async () => {
    const { mockClient, insertCalls } = createMockClient();
    const event = {
      actor: { user_id: 'user-1', tenant_id: 'tenant-1' },
      action: 'api_data_access',
      resource: '/api/chat',
      result: 'allowed',
      severity: 'INFO' as const,
    };

    await emitAudit(mockClient, event, { salt: 'test-salt' });

    const row = insertCalls[0] as Record<string, unknown>;
    expect(row.ip_hash).toBeNull();
  });
});

describe('hashIp', () => {
  it('returns deterministic sha-256 hex for a salt+ip pair', async () => {
    const hash1 = await hashIp('1.2.3.4', 'salt-a');
    const hash2 = await hashIp('1.2.3.4', 'salt-a');
    const hash3 = await hashIp('1.2.3.4', 'salt-b');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});
