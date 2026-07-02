import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateSessionMock = vi.fn();
const rateLimitCheckMock = vi.fn();
const getUserMock = vi.fn();

function createHeaders() {
  const headers = new Map<string, string>();

  return {
    set: (key: string, value: string) => headers.set(key.toLowerCase(), value),
    get: (key: string) => headers.get(key.toLowerCase()) ?? null,
  };
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

vi.mock('@/lib/observability/metrics', () => ({
  recordRateLimitRequest: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  getLogger: vi.fn(() => ({ warn: vi.fn() })),
}));

vi.mock('@/lib/audit', () => ({
  emitAudit: vi.fn(),
}));

vi.mock('@/lib/api-security', () => ({
  getSessionTenantId: vi.fn(() => 'tenant-123'),
  ANONYMOUS_TENANT_ID: 'anonymous',
}));

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => createResponse()),
    json: vi.fn(() => createResponse()),
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
    headers: {
      get: headers.get,
      set: headers.set,
    },
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

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(response.headers.get('x-correlation-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('delegates public auth pages to updateSession instead of redirecting away', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest('/forgot-password');

    await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
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

  it('preserves an incoming correlation id', async () => {
    const middleware = await loadMiddleware();
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    const request = createRequest('/dashboard', existingId);

    await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(request.headers.get('x-correlation-id')).toBe(existingId);
  });
});
