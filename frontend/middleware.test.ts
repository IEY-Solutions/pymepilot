import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateSessionMock = vi.fn();
const rateLimitCheckMock = vi.fn();
const getUserMock = vi.fn();
const emitAuditMock = vi.fn();

function createHeaders() {
  return new Headers();
}

function createResponse() {
  return {
    headers: createHeaders(),
    cookies: { set: vi.fn() },
  };
}

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: updateSessionMock,
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRateLimiter: {
    check: rateLimitCheckMock,
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock('@/lib/observability/metrics.edge', () => ({
  recordRateLimitRequest: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  getLogger: vi.fn(() => ({ warn: vi.fn() })),
}));

vi.mock('@/lib/audit', () => ({
  emitAudit: emitAuditMock,
}));

vi.mock('@/lib/api-security', () => ({
  getSessionTenantId: vi.fn(() => 'tenant-123'),
  ANONYMOUS_TENANT_ID: 'anonymous',
}));

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ ...createResponse(), status: 200 })),
    json: vi.fn((_body, init) => {
      const response = { ...createResponse(), status: init?.status };
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => response.headers.set(key, value));
      }
      return response;
    }),
  },
}));

async function loadMiddleware() {
  const mod = await import('./middleware');
  return mod.middleware;
}

function createRequest(pathname: string, correlationId?: string) {
  const headers = createHeaders();
  if (correlationId) {
    headers.set('x-correlation-id', correlationId);
  }

  return {
    headers,
    nextUrl: {
      pathname,
      clone: vi.fn(() => ({ pathname })),
    },
    cookies: {
      getAll: () => [],
    },
  } as unknown as import('next/server').NextRequest;
}

describe('frontend middleware auth gate and correlation id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheckMock.mockReturnValue({ allowed: true, limit: 10, windowMs: 60000 });
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    updateSessionMock.mockResolvedValue(createResponse());
  });

  it('delegates protected page requests to updateSession and preserves correlation id', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest('/dashboard');

    const response = await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request, expect.any(Headers));
    expect(response.headers.get('x-correlation-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(request.headers.get('x-correlation-id')).toBeNull();
  });

  it('delegates public auth pages to updateSession instead of redirecting away', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest('/forgot-password');

    await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request, expect.any(Headers));
  });

  it('keeps /api/* outside the redirect gate and does not call updateSession', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest('/api/health');

    const response = await middleware(request);

    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(rateLimitCheckMock).toHaveBeenCalledWith('user-1', '/api/health');
    expect(response.headers.get('x-correlation-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('preserves 429 when best-effort audit emission fails', async () => {
    emitAuditMock.mockRejectedValueOnce(new Error('audit write failed'));
    rateLimitCheckMock.mockReturnValue({ allowed: false, limit: 10, windowMs: 60000, retryAfterSeconds: 30 });

    const middleware = await loadMiddleware();
    const request = createRequest('/api/chat');
    const waitUntil = vi.fn();

    const response = await middleware(request, { waitUntil } as never);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('preserves an incoming correlation id', async () => {
    const middleware = await loadMiddleware();
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    const request = createRequest('/dashboard', existingId);

    await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request, expect.any(Headers));
    expect(request.headers.get('x-correlation-id')).toBe(existingId);
  });
});
