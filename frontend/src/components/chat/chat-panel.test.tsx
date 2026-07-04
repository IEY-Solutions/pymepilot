import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from './chat-panel';
import { useChat } from '@/contexts/chat-context';
import type { ChatContextType } from '@/contexts/chat-context';

vi.mock('@/contexts/chat-context', () => ({
  useChat: vi.fn(),
}));

const mockRetry = vi.fn();

window.HTMLElement.prototype.scrollIntoView = vi.fn();

function mockUseChat(partial: Partial<ChatContextType>) {
  const base: ChatContextType = {
    messages: [],
    isOpen: true,
    isLoading: false,
    error: null,
    errorType: null,
    canRetry: false,
    retryAfter: null,
    usage: null,
    sendMessage: vi.fn(),
    retry: mockRetry,
    toggleChat: vi.fn(),
    openChat: vi.fn(),
    closeChat: vi.fn(),
    clearChat: vi.fn(),
  };
  (useChat as ReturnType<typeof vi.fn>).mockReturnValue({ ...base, ...partial });
}

describe('ChatPanel retry button', () => {
  it('shows retry button on timeout errors', () => {
    mockUseChat({
      error: 'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.',
      errorType: 'timeout',
      canRetry: true,
    });

    render(<ChatPanel />);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('hides retry button on rate limit errors', () => {
    mockUseChat({
      error: 'Límite de consultas alcanzado. Probá más tarde.',
      errorType: 'rate_limit',
      canRetry: false,
      retryAfter: 120,
    });

    render(<ChatPanel />);
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('shows availability time on rate limit errors', () => {
    mockUseChat({
      error: 'Límite de consultas alcanzado. Probá más tarde.',
      errorType: 'rate_limit',
      canRetry: false,
      retryAfter: 120,
    });

    render(<ChatPanel />);
    expect(screen.getByText(/disponible en/i)).toBeInTheDocument();
  });

  it('calls retry callback when retry button is clicked', () => {
    mockUseChat({
      error: 'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.',
      errorType: 'timeout',
      canRetry: true,
    });

    render(<ChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
