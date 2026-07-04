import { describe, it, expect, vi } from 'vitest';
import { emitAudit, hashIp } from './audit';

const mockServiceRpc = vi.fn();
const mockServiceClient = {
  rpc: mockServiceRpc,
};

vi.mock('@/lib/supabase/service', () => ({
  createAuditServiceClient: vi.fn(() => ({
    rpc: mockServiceClient.rpc,
  })),
}));

function createMockClient() {
  const mockClient = {
    from: vi.fn(),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
  return { mockClient };
}

describe('emitAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceRpc.mockResolvedValue({ error: null });
  });

  it('inserts an audit event with hashed ip', async () => {
    const { mockClient } = createMockClient();
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

    expect(mockClient.from).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).toHaveBeenCalledWith('record_audit_log', {
      p_actor_user_id: 'user-1',
      p_actor_tenant_id: 'tenant-1',
      p_action: 'auth.access_denied',
      p_resource: '/api/pipeline',
      p_result: 'denied',
      p_correlation_id: 'corr-1',
      p_severity: 'WARNING',
      p_ip_hash: await hashIp('192.168.1.1', 'test-salt'),
      p_details: {},
    });
  });

  it('omits ip_hash when no ip is provided', async () => {
    const { mockClient } = createMockClient();
    const event = {
      actor: { user_id: 'user-1', tenant_id: 'tenant-1' },
      action: 'api_data_access',
      resource: '/api/chat',
      result: 'allowed',
      severity: 'INFO' as const,
    };

    await emitAudit(mockClient, event, { salt: 'test-salt' });

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      'record_audit_log',
      expect.objectContaining({ p_ip_hash: null })
    );
  });

  it('stores anonymous actor ids as null so inserts stay valid', async () => {
    const { mockClient } = createMockClient();
    const event = {
      actor: { user_id: 'anonymous', tenant_id: 'tenant-1' },
      action: 'auth.access_denied',
      resource: '/api/chat',
      result: 'denied',
      severity: 'WARNING' as const,
    };

    await emitAudit(mockClient, event, { salt: 'test-salt' });

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      'record_audit_log',
      expect.objectContaining({ p_actor_user_id: null })
    );
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
