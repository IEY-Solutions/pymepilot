import {
  getCircuitBreaker,
  setCircuitBreakerCorrelationId,
} from './circuit-breaker';
import {
  recordChatRetryAttempt,
  recordChatDegradedResponse,
  recordChatUpstreamError,
  recordChatError,
} from '@/lib/observability/metrics';

export interface ResilienceOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  correlationId?: string;
}

export interface ResilientError extends Error {
  type?: 'timeout' | 'rate_limit' | 'circuit_open' | 'upstream_error' | 'transient_error';
  status?: number;
  retryAfter?: number;
  correlationId?: string;
}

interface FailureClassification {
  retryable: boolean;
  type: ResilientError['type'];
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function classifyError(error: unknown): FailureClassification {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (status === 429) {
      return { retryable: false, type: 'rate_limit' };
    }
    if (typeof status === 'number' && status >= 500 && status < 600) {
      return { retryable: true, type: 'upstream_error' };
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return { retryable: false, type: 'upstream_error' };
    }
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return { retryable: true, type: 'timeout' };
  }

  return { retryable: true, type: 'transient_error' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractRetryAfter(error: unknown): number {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.retryAfter === 'number' && !Number.isNaN(err.retryAfter)) {
      return err.retryAfter;
    }
    const headers = err.headers;
    if (headers && typeof headers === 'object') {
      const value =
        (headers as Record<string, unknown>)['retry-after'] ??
        (headers as Record<string, unknown>)['Retry-After'];
      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  }
  return 60;
}

function exponentialBackoff(attempt: number, baseDelayMs: number): number {
  const exponential = Math.min(baseDelayMs * 2 ** attempt, 30000);
  const jitter = exponential * 0.25 * (Math.random() - 0.5);
  return Math.max(0, Math.floor(exponential + jitter));
}

export async function withResilience<T>(
  tenantId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  options: ResilienceOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const correlationId = options.correlationId ?? generateCorrelationId();
  const breaker = getCircuitBreaker(tenantId);

  setCircuitBreakerCorrelationId(tenantId, correlationId);

  const runOnce = async (): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await operation(controller.signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutErr = new Error(
          'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.'
        ) as ResilientError;
        timeoutErr.type = 'timeout';
        timeoutErr.correlationId = correlationId;
        throw timeoutErr;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const executeWithRetry = async (): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await runOnce();
      } catch (error) {
        lastError = error;
        const classification = classifyError(error);

        if (classification.type === 'rate_limit') {
          const retryAfter = extractRetryAfter(error);
          const err = new Error(
            'Límite de consultas alcanzado. Probá más tarde.'
          ) as ResilientError;
          err.type = 'rate_limit';
          err.status = 429;
          err.retryAfter = retryAfter;
          err.correlationId = correlationId;
          throw err;
        }

        const isRetryable = classification.retryable;
        if (!isRetryable || attempt === maxRetries) {
          if (classification.type === 'timeout') {
            recordChatDegradedResponse(tenantId, 'timeout');
          }
          throw error;
        }

        recordChatRetryAttempt(tenantId);
        const delayMs = exponentialBackoff(attempt, baseDelayMs);
        await sleep(delayMs);
      }
    }

    throw lastError;
  };

  try {
    return (await breaker.fire(executeWithRetry)) as T;
  } catch (error) {
    const classification = classifyError(error);

    if (breaker.opened) {
      const err = new Error(
        'El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.'
      ) as ResilientError;
      err.type = 'circuit_open';
      err.correlationId = correlationId;
      throw err;
    }

    if (classification.type === 'timeout') {
      recordChatDegradedResponse(tenantId, 'timeout');
    } else if (classification.type === 'upstream_error') {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? String((error as { status: unknown }).status)
          : 'unknown';
      recordChatUpstreamError(tenantId, status);
      recordChatError(tenantId, 'upstream_error');
    }

    if (error && typeof error === 'object') {
      (error as ResilientError).correlationId = correlationId;
    }

    throw error;
  }
}
