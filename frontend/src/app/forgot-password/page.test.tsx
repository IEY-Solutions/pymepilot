import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import ForgotPasswordPage from './page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ForgotPasswordPage (Fase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'http://localhost:3000' },
    });
  });

  // ── Presence ──────────────────────────────────────────────────────────
  it('renders an email input and a submit button', () => {
    render(<ForgotPasswordPage />);

    expect(
      screen.getByLabelText(/email|correo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /enviar|recuperar|restablecer/i }),
    ).toBeInTheDocument();
  });

  // ── Happy path ────────────────────────────────────────────────────────
  it('calls resetPasswordForEmail with the entered email on submit', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    const input = screen.getByLabelText(/email|correo/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });

    await act(async () => {
      screen
        .getByRole('button', { name: /enviar|recuperar|restablecer/i })
        .click();
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'http://localhost:3000/auth/callback' },
    );
  });

  // ── Generic success message (anti-enumeration) ────────────────────────
  it('shows a generic success message that does not reveal whether the email exists', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    const input = screen.getByLabelText(/email|correo/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });
    await act(async () => {
      screen
        .getByRole('button', { name: /enviar|recuperar|restablecer/i })
        .click();
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Si el email existe en el sistema, recibirás un enlace de recuperación.',
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Error handling (generic, anti-enumeration) ────────────────────────
  it('shows a generic error message when the API call fails', async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error('Network error'));
    render(<ForgotPasswordPage />);

    const input = screen.getByLabelText(/email|correo/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });
    await act(async () => {
      screen
        .getByRole('button', { name: /enviar|recuperar|restablecer/i })
        .click();
    });

    await waitFor(() => {
      const errorMsg = screen.getByText(/error|problema|intentá|intenta/i);
      expect(errorMsg).toBeInTheDocument();
      // The message MUST NOT reveal whether the email exists in the system.
      expect(errorMsg.textContent).not.toMatch(
        /no (encontrado|registrado|existe)/i,
      );
    });
  });

  it('shows a rate-limit message when Supabase returns over_email_send_rate_limit', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    render(<ForgotPasswordPage />);

    const input = screen.getByLabelText(/email|correo/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });
    await act(async () => {
      screen
        .getByRole('button', { name: /enviar|recuperar|restablecer/i })
        .click();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/pediste un enlace de recuperación hace poco/i),
      ).toBeInTheDocument();
    });
  });

  // ── Navigation back ───────────────────────────────────────────────────
  it('renders a link back to /login', () => {
    render(<ForgotPasswordPage />);

    const backLink = screen.getByRole('link', {
      name: /volver|login|iniciar sesión/i,
    });
    expect(backLink).toHaveAttribute('href', '/login');
  });

  it('shows a recovery hint when the callback sends the user back here', () => {
    render(<ForgotPasswordPage searchParams={{ reason: 'recovery-invalid' }} />);

    expect(
      screen.getByText(/enlace de recuperación no es válido o expiró/i),
    ).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────────────
  it('disables the submit button while loading', async () => {
    // Keep the promise pending so loading stays true.
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));
    render(<ForgotPasswordPage />);

    const input = screen.getByLabelText(/email|correo/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });

    const button = screen.getByRole('button', {
      name: /enviar|recuperar|restablecer/i,
    });
    await act(async () => {
      button.click();
    });

    // Button must be disabled and show a loading indicator.
    expect(button).toBeDisabled();
    expect(button.textContent).toMatch(/enviando|enviar|\.\.\./i);
  });
});
