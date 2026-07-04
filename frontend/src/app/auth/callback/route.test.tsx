import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, waitFor } from '@testing-library/react';
import AuthCallbackPage from './page';

const mockExchangeCodeForSession = vi.fn();
const mockSetSession = vi.fn();
const mockReplace = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      setSession: mockSetSession,
    },
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

function setUrl(url: string) {
  const parsed = new URL(url);
  window.history.pushState({}, '', `${parsed.pathname}${parsed.search}${parsed.hash}`);
}

describe('/auth/callback password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to forgot-password when neither code nor recovery tokens are provided', async () => {
    setUrl('http://localhost/auth/callback');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/forgot-password?reason=recovery-missing-code',
      );
    });

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('exchanges the code for a recovery session and redirects to /reset-password', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    setUrl('http://localhost/auth/callback?code=recovery-code-123');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/reset-password');
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('recovery-code-123');
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('sets the recovery session from the redirect hash and then opens /reset-password', async () => {
    mockSetSession.mockResolvedValue({ error: null });
    setUrl('http://localhost/auth/callback#access_token=access-123&refresh_token=refresh-456');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/reset-password');
    });

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to forgot-password when the hash session is invalid', async () => {
    mockSetSession.mockResolvedValue({
      error: { message: 'Invalid recovery session' },
    });
    setUrl('http://localhost/auth/callback#access_token=access-123&refresh_token=refresh-456');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/forgot-password?reason=recovery-invalid',
      );
    });

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to forgot-password when the code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid or expired code' },
    });
    setUrl('http://localhost/auth/callback?code=bad-code');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/forgot-password?reason=recovery-invalid',
      );
    });
  });

  it('does not leak the recovery code in the redirect target', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    setUrl('http://localhost/auth/callback?code=secret-code');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/reset-password');
    });

    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('secret-code'));
  });
});
