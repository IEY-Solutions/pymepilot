import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ChatProvider, useChat } from './chat-context';
import type { ChatErrorResponse, ChatResponse } from '@/lib/chat/types';

const mockFetch = vi.fn();

describe('ChatContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  function TestComponent() {
    const { error, errorType, canRetry, retryAfter, retry, sendMessage } = useChat();
    return (
      <div>
        <div data-testid="error">{error ?? 'no-error'}</div>
        <div data-testid="errorType">{errorType ?? 'no-type'}</div>
        <div data-testid="canRetry">{canRetry ? 'yes' : 'no'}</div>
        <div data-testid="retryAfter">{retryAfter ?? 'no-retry-after'}</div>
        <button data-testid="send" onClick={() => sendMessage('hola')}>
          Send
        </button>
        <button data-testid="retry" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  it('parses timeout errors as retryable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () =>
        ({
          error: 'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.',
        } as ChatErrorResponse),
    });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await act(async () => {
      screen.getByTestId('send').click();
    });

    await waitFor(() => expect(screen.getByTestId('error').textContent).not.toBe('no-error'));
    expect(screen.getByTestId('errorType').textContent).toBe('timeout');
    expect(screen.getByTestId('canRetry').textContent).toBe('yes');
  });

  it('parses 429 errors as non-retryable with retryAfter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () =>
        ({
          error: 'Límite de consultas alcanzado. Probá más tarde.',
          retry_after: 120,
        } as ChatErrorResponse),
    });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await act(async () => {
      screen.getByTestId('send').click();
    });

    await waitFor(() => expect(screen.getByTestId('error').textContent).not.toBe('no-error'));
    expect(screen.getByTestId('errorType').textContent).toBe('rate_limit');
    expect(screen.getByTestId('canRetry').textContent).toBe('no');
    expect(screen.getByTestId('retryAfter').textContent).toBe('120');
  });

  it('retries the last user message when retry is invoked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () =>
          ({
            error: 'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.',
          } as ChatErrorResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () =>
          ({
            response: 'Todo bien',
            usage: { questions_today: 1, daily_limit: 20 },
          } as ChatResponse),
      });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await act(async () => {
      screen.getByTestId('send').click();
    });
    await waitFor(() => expect(screen.getByTestId('canRetry').textContent).toBe('yes'));

    await act(async () => {
      screen.getByTestId('retry').click();
    });
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('no-error'));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const lastBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(lastBody.message).toBe('hola');
  });
});
