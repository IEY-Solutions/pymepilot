import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

function createRequest(url: string) {
  return new NextRequest(url);
}

describe('/auth/callback password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to forgot-password when no recovery code is provided', async () => {
    const request = createRequest('http://localhost/auth/callback');
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/forgot-password?reason=recovery-missing-code',
    );
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('exchanges the code for a recovery session and redirects to /reset-password without code', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createRequest(
      'http://localhost/auth/callback?code=recovery-code-123',
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost/reset-password');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code-123');
    expect(response.cookies.get('pp-recovery-flow')).toBeUndefined();
  });

  it('redirects to forgot-password when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid or expired code' },
    });

    const request = createRequest(
      'http://localhost/auth/callback?code=bad-code',
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/forgot-password?reason=recovery-invalid',
    );
  });

  it('does not leak the recovery code in the redirect URL', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createRequest(
      'http://localhost/auth/callback?code=secret-code',
    );
    const response = await GET(request);

    const location = response.headers.get('location')!;
    const redirectUrl = new URL(location);
    expect(redirectUrl.pathname).toBe('/reset-password');
    expect(redirectUrl.searchParams.get('code')).toBeNull();
  });
});
