import { describe, it, expect, vi, beforeEach } from 'vitest';

const responseInstances: Array<{ request: unknown; headers: { set: typeof setHeader; get: (key: string) => string | null } }> = [];
const currentHeaders = new Map<string, string>();
const setHeader = vi.fn((key: string, value: string) => currentHeaders.set(key.toLowerCase(), value));
const getHeader = (key: string): string | null => currentHeaders.get(key.toLowerCase()) ?? null;

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(({ request }: { request: unknown }) => {
      const instance = { request, headers: { set: setHeader, get: getHeader } };
      responseInstances.push(instance);
      return instance;
    }),
  },
}));

async function loadMiddleware() {
  const mod = await import('./middleware');
  return mod.middleware;
}

function createRequest(correlationId?: string) {
  const headers = new Map<string, string>();
  if (correlationId) headers.set('x-correlation-id', correlationId);
  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
      set: (key: string, value: string) => headers.set(key.toLowerCase(), value),
    },
  } as unknown as import('next/server').NextRequest;
}

describe('middleware correlation id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseInstances.length = 0;
    currentHeaders.clear();
  });

  it('generates a UUID v4 correlation id when the header is absent', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest();

    await middleware(request);

    expect(setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
    const id = setHeader.mock.calls[0][1] as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('preserves an existing x-correlation-id header', async () => {
    const middleware = await loadMiddleware();
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    const request = createRequest(existingId);

    await middleware(request);

    expect(setHeader).toHaveBeenCalledWith('X-Correlation-ID', existingId);
  });

  it('stores the correlation id on the request for downstream use', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest();

    await middleware(request);

    const id = setHeader.mock.calls[0][1] as string;
    expect(request.headers.get('x-correlation-id')).toBe(id);
  });

  it('returns X-Correlation-ID on the response', async () => {
    const middleware = await loadMiddleware();
    const request = createRequest();

    const response = await middleware(request);

    const id = setHeader.mock.calls[0][1] as string;
    expect(response.headers.get('X-Correlation-ID')).toBe(id);
  });
});
