import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { register } from '@/lib/observability/metrics';
import type { ResilientError } from '@/lib/chat/resilience';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

vi.mock('@/lib/chat/resilience', () => ({
  withResilience: vi.fn(async (_tenantId: string, operation: (signal: AbortSignal) => Promise<unknown>) => {
    try {
      return await operation(new AbortController().signal);
    } catch (error: any) {
      const err = new Error(error?.message || 'upstream error') as ResilientError;
      if (error?.status === 429) {
        err.type = 'rate_limit';
        err.status = 429;
        err.retryAfter = error?.retryAfter ?? 60;
      } else if (error?.status === 503) {
        err.type = 'upstream_error';
        err.status = 503;
      } else if (error?.name === 'AbortError') {
        err.type = 'timeout';
      } else {
        err.type = 'upstream_error';
        err.status = error?.status;
      }
      throw err;
    }
  }),
}));

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    register.resetMetrics();
    vi.clearAllMocks();
    vi.stubGlobal('process', { ...process, env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' } });

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { tenant_id: 'tenant-1' },
        },
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'chat_usage') {
        const eq2 = vi.fn(() => ({ count: 0 }));
        const eq1 = vi.fn(() => ({ eq: eq2 }));
        return {
          select: vi.fn(() => ({ eq: eq1 })),
          insert: mockInsert,
        };
      }
      if (table === 'tenants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle,
            })),
          })),
        };
      }
      return {};
    });

    mockSingle.mockResolvedValue({ data: { name: 'Demo Tenant' } });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(buildRequest({ message: 'hola' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('No autenticado');
  });

  it('returns chat response on successful upstream call', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Todo bien' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
    });

    const response = await POST(buildRequest({ message: 'hola' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.response).toBe('Todo bien');
  });

  it('returns 503 on genuine upstream 503 after retries', async () => {
    mockCreate.mockRejectedValue({ status: 503, message: 'Service Unavailable' });

    const response = await POST(buildRequest({ message: 'hola' }));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.');
  });

  it('returns 200 degraded response on timeout', async () => {
    mockCreate.mockRejectedValue({ name: 'AbortError', message: 'timeout' });

    const response = await POST(buildRequest({ message: 'hola' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.');
  });

  it('returns rate limit spanish message on upstream 429 without retry', async () => {
    mockCreate.mockRejectedValue({ status: 429, message: 'Too Many Requests', retryAfter: 65 });

    const response = await POST(buildRequest({ message: 'hola' }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Límite de consultas alcanzado. Probá más tarde.');
    expect(data.retry_after).toBe(65);
  });
});
