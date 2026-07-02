import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import ResetPasswordPage from './page';

const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockReplace = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  async function renderPage() {
    render(await ResetPasswordPage());
  }

  it('renders the password form when the Supabase session is valid', async () => {
    await renderPage();

    expect(await screen.findByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('shows an invalid/expired state when the Supabase session is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await renderPage();

    expect(
      screen.getByText(/enlace de recuperación no es válido o expiró/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('rejects a password that is shorter than the minimum', async () => {
    await renderPage();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
        target: { value: 'short' },
      });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
        target: { value: 'short' },
      });
      fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
    });

    expect(
      screen.getByText('La contraseña debe tener al menos 6 caracteres.'),
    ).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows a loading state while updating the password', async () => {
    mockUpdateUser.mockReturnValue(new Promise(() => {}));

    await renderPage();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
        target: { value: 'SecurePass1' },
      });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
        target: { value: 'SecurePass1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
    });

    expect(screen.getByRole('button', { name: /cambiando/i })).toBeDisabled();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeDisabled();
  });

  it('updates the password, signs out, and redirects to /login', async () => {
    await renderPage();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
        target: { value: 'SecurePass1' },
      });
      fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
        target: { value: 'SecurePass1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'SecurePass1' });
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
