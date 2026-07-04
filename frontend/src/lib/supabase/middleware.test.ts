import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSession } from './middleware';
import type { NextRequest } from 'next/server';

const getUserMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
    },
  })),
}));

const nextResponseMock = { cookies: { set: vi.fn() } };
const redirectResponseMock = { cookies: { set: vi.fn() } };

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => nextResponseMock),
    redirect: vi.fn(() => redirectResponseMock),
  },
}));

function createRequest(
  pathname: string,
  headers: Record<string, string> = {},
  cookies: Array<{ name: string; value: string }> = []
): NextRequest {
  const nextUrl = {
    pathname,
    clone: vi.fn(() => ({ pathname })),
  };
  return {
    nextUrl,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    cookies: {
      getAll: () => cookies,
      set: vi.fn(),
    },
  } as unknown as NextRequest;
}

describe('updateSession prefetch detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses getUser on RSC prefetch for protected-route auth decisions', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Router-Prefetch': '1' });

    const response = await updateSession(request);

    expect(getUserMock).toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(response).toBe(nextResponseMock);
  });

  it('detects Next-Action as a request that still validates via getUser', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Action': 'action-id' });

    await updateSession(request);

    expect(getUserMock).toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('detects Purpose: prefetch as a request that still validates via getUser', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const request = createRequest('/dashboard', { Purpose: 'prefetch' });

    await updateSession(request);

    expect(getUserMock).toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('calls getUser on full navigation', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const request = createRequest('/dashboard');

    await updateSession(request);

    expect(getUserMock).toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated prefetch to login', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Router-Prefetch': '1' });

    const response = await updateSession(request);

    expect(response).toBe(redirectResponseMock);
  });
});

// ---------------------------------------------------------------------------
// Public auth routes (forgot/reset password)
// ---------------------------------------------------------------------------
describe('updateSession public auth routes (Fase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockReset();
    getSessionMock.mockReset();
    getSessionMock.mockImplementation(() => {
      throw new Error('getSession should not be called in updateSession');
    });
  });

  it('allows /forgot-password without authentication (full navigation)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const request = createRequest('/forgot-password');

    const response = await updateSession(request);

    expect(response).toBe(nextResponseMock);
  });

  it('allows /reset-password without authentication (full navigation)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const request = createRequest('/reset-password');

    const response = await updateSession(request);

    expect(response).toBe(nextResponseMock);
  });

  it('allows /forgot-password without authentication (prefetch)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const request = createRequest('/forgot-password', {
      'Next-Router-Prefetch': '1',
    });

    const response = await updateSession(request);

    expect(response).toBe(nextResponseMock);
  });

  it('allows /reset-password without authentication (prefetch)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const request = createRequest('/reset-password', {
      'Next-Router-Prefetch': '1',
    });

    const response = await updateSession(request);

    expect(response).toBe(nextResponseMock);
  });
});
