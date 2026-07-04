import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import LoginPage from './page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

// BrandLockup uses next/image; provide a lightweight replacement for jsdom.
vi.mock('next/image', () => ({
  default: function MockImg(props: Record<string, unknown>) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { unoptimized: _unoptimized, ...rest } = props as React.ImgHTMLAttributes<HTMLImageElement> & {
      unoptimized?: unknown;
    };
    return <img {...rest} />;
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage – forgot-password link (Fase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  // RED: the link does not exist yet. This assertion proves it must be added.
  it('renders a link to recover password', () => {
    render(<LoginPage />);

    expect(
      screen.getByRole('link', { name: /olvidaste|recuperar|restablecer/i }),
    ).toBeInTheDocument();
  });

  // RED: the link does not exist yet. When it does, it must point to the
  // correct public route.
  it('points to /forgot-password', () => {
    render(<LoginPage />);

    const link = screen.getByRole('link', {
      name: /olvidaste|recuperar|restablecer/i,
    });
    expect(link).toHaveAttribute('href', '/forgot-password');
  });

  it('shows an error when login fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login' } });
    render(<LoginPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/contraseña/i), {
        target: { value: 'bad-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
    });

    expect(await screen.findByText(/email o contraseña incorrectos/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a loading state while the login request is pending', async () => {
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/contraseña/i), {
        target: { value: 'correct-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
    });

    const button = screen.getByRole('button', { name: /ingresando/i });

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/ingresando/i);
  });

  it('redirects to the home page on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/contraseña/i), {
        target: { value: 'correct-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(mockRefresh).toHaveBeenCalled();
  });
});
