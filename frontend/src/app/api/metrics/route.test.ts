import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { register, recordHttpRequest } from '@/lib/observability/metrics';

describe('/api/metrics', () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it('returns prometheus exposition format with 200', async () => {
    recordHttpRequest({ endpoint: '/api/chat', method: 'POST', status_code: '200', tenant_id: 'tenant-1' });

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('# HELP http_requests_total Total HTTP requests');
    expect(text).toContain('http_requests_total{endpoint="/api/chat",method="POST",status_code="200",tenant_id="tenant-1"} 1');
  });
});
