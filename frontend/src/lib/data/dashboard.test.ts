import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cache', () => ({
  withRequestDedup: vi.fn((fn) => fn),
  withSwrCache: vi.fn((_prefix, fn, _opts) => fn),
}));

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  })),
}));

import {
  getCurrentUser,
  getUnreadNotificationsCount,
  getPendingPredictionsCount,
  getTotalPredictionsCount,
  getContactedPredictionsCount,
  getActiveCustomersCount,
  getLastSync,
  getTodayPredictionsCount,
  getLastRun,
} from './dashboard';

function createCountChain(count: number | null) {
  const result = { count };
  return {
    eq: vi.fn(() => Promise.resolve(result)),
    in: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
}

function mockCount(count: number | null) {
  return {
    select: vi.fn(() => createCountChain(count)),
  };
}

function mockSingle(data: unknown) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data })),
        })),
      })),
    })),
  };
}

describe('dashboard data fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current user', async () => {
    const user = { id: 'u1', user_metadata: { tenant_id: 't1' } };
    getUserMock.mockResolvedValue({ data: { user } });

    const result = await getCurrentUser();

    expect(result).toBe(user);
  });

  it('returns unread notifications count', async () => {
    fromMock.mockReturnValue(mockCount(5));

    const result = await getUnreadNotificationsCount('t1');

    expect(result).toBe(5);
  });

  it('falls back to 0 when count is null', async () => {
    fromMock.mockReturnValue(mockCount(null));

    const result = await getPendingPredictionsCount();

    expect(result).toBe(0);
  });

  it('returns total predictions count', async () => {
    fromMock.mockReturnValue(mockCount(42));

    const result = await getTotalPredictionsCount();

    expect(result).toBe(42);
  });

  it('returns contacted predictions count', async () => {
    fromMock.mockReturnValue(mockCount(10));

    const result = await getContactedPredictionsCount();

    expect(result).toBe(10);
  });

  it('returns active customers count', async () => {
    fromMock.mockReturnValue(mockCount(8));

    const result = await getActiveCustomersCount();

    expect(result).toBe(8);
  });

  it('returns last sync info', async () => {
    fromMock.mockReturnValue(
      mockSingle({ started_at: '2026-06-15T12:00:00Z', status: 'completed' })
    );

    const result = await getLastSync();

    expect(result).toEqual({
      started_at: '2026-06-15T12:00:00Z',
      status: 'completed',
    });
  });

  it('returns today predictions count', async () => {
    fromMock.mockReturnValue(mockCount(3));

    const result = await getTodayPredictionsCount();

    expect(result).toBe(3);
  });

  it('returns last run info', async () => {
    fromMock.mockReturnValue(
      mockSingle({
        completed_at: '2026-06-15T10:00:00Z',
        status: 'completed',
        predictions_generated: 12,
      })
    );

    const result = await getLastRun();

    expect(result).toEqual({
      completed_at: '2026-06-15T10:00:00Z',
      status: 'completed',
      predictions_generated: 12,
    });
  });
});
