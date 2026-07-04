import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { register, recordHttpRequest } from '@/lib/observability/metrics';

const originalMetricsToken = process.env.METRICS_AUTH_TOKEN;

describe('/api/metrics', () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  afterEach(() => {
    if (originalMetricsToken === undefined) {
      delete process.env.METRICS_AUTH_TOKEN;
    } else {
      process.env.METRICS_AUTH_TOKEN = originalMetricsToken;
    }
  });

  it('returns prometheus exposition format with 200', async () => {
    process.env.METRICS_AUTH_TOKEN = 'test-token';
    recordHttpRequest({ endpoint: '/api/chat', method: 'POST', status_code: '200', tenant_id: 'tenant-1' });

    const response = await GET(new Request('http://localhost/api/metrics', {
      headers: { authorization: 'Bearer test-token' },
    }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('# HELP http_requests_total Total HTTP requests');
    expect(text).toContain('http_requests_total{endpoint="/api/chat",method="POST",status_code="200",tenant_id="tenant-1"} 1');
  });

  it('fails closed when METRICS_AUTH_TOKEN is missing', async () => {
    delete process.env.METRICS_AUTH_TOKEN;

    const response = await GET(new Request('http://localhost/api/metrics'));

    expect(response.status).toBe(503);
  });

  it('rejects mismatched bearer tokens with 401', async () => {
    process.env.METRICS_AUTH_TOKEN = 'expected-token';

    const response = await GET(new Request('http://localhost/api/metrics', {
      headers: { authorization: 'Bearer wrong-token' },
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
  });
});
