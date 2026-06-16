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

  it('uses local session on RSC prefetch instead of getUser', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Router-Prefetch': '1' });

    const response = await updateSession(request);

    expect(getUserMock).not.toHaveBeenCalled();
    expect(getSessionMock).toHaveBeenCalled();
    expect(response).toBe(nextResponseMock);
  });

  it('detects Next-Action as a prefetch request', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Action': 'action-id' });

    await updateSession(request);

    expect(getUserMock).not.toHaveBeenCalled();
    expect(getSessionMock).toHaveBeenCalled();
  });

  it('detects Purpose: prefetch as a prefetch request', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    const request = createRequest('/dashboard', { Purpose: 'prefetch' });

    await updateSession(request);

    expect(getUserMock).not.toHaveBeenCalled();
    expect(getSessionMock).toHaveBeenCalled();
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
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const request = createRequest('/dashboard', { 'Next-Router-Prefetch': '1' });

    const response = await updateSession(request);

    expect(response).toBe(redirectResponseMock);
  });
});
