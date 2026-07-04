import { describe, it, expect } from 'vitest';
import { createLogger } from './logger';

describe('pino logger schema', () => {
  it('emits JSON with required observability fields', async () => {
    const lines: string[] = [];
    const logger = createLogger({
      write: (line: string) => lines.push(line),
    });

    logger.info({ event: 'test.event', correlation_id: 'corr-1', tenant_id: 'tenant-1' }, 'hello');

    expect(lines.length).toBe(1);
    const record = JSON.parse(lines[0]);
    expect(record).toMatchObject({
      level: 30,
      logger: 'pymepilot',
      message: 'hello',
      event: 'test.event',
      correlation_id: 'corr-1',
      tenant_id: 'tenant-1',
      timestamp: expect.any(String),
    });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  it('flattens context fields into the top-level record', async () => {
    const lines: string[] = [];
    const logger = createLogger({
      write: (line: string) => lines.push(line),
    });

    logger.warn({ context: { endpoint: '/api/test', method: 'GET' } }, 'context test');

    const record = JSON.parse(lines[0]);
    expect(record.endpoint).toBe('/api/test');
    expect(record.method).toBe('GET');
    expect(record.context).toBeUndefined();
  });

  it('does not log raw PII such as emails', async () => {
    const lines: string[] = [];
    const logger = createLogger({
      write: (line: string) => lines.push(line),
    });

    logger.info({ email: 'user@example.com' }, 'login');

    const record = JSON.parse(lines[0]);
    expect(record.email).toBe('***REDACTED***');
  });
});
