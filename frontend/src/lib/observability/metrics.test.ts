import { describe, it, expect, beforeEach } from 'vitest';
import {
  register,
  recordHttpRequest,
  recordHttpRequestDuration,
  setCircuitBreakerState,
  recordChatRequest,
  recordChatRequestDuration,
  recordChatError,
  recordApiDataExposure,
  recordRscPrefetch,
  recordRateLimitRequest,
  recordAuditEvent,
} from './metrics';

describe('prometheus metrics', () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it('exports a prom-client register', () => {
    expect(register).toBeDefined();
    expect(typeof register.metrics).toBe('function');
  });

  it('increments http_requests_total with labels', async () => {
    recordHttpRequest({ endpoint: '/api/chat', method: 'POST', status_code: '200', tenant_id: 'tenant-1' });
    recordHttpRequest({ endpoint: '/api/chat', method: 'POST', status_code: '500', tenant_id: 'tenant-1' });

    const metrics = await register.metrics();
    expect(metrics).toContain('http_requests_total{endpoint="/api/chat",method="POST",status_code="200",tenant_id="tenant-1"} 1');
    expect(metrics).toContain('http_requests_total{endpoint="/api/chat",method="POST",status_code="500",tenant_id="tenant-1"} 1');
  });

  it('records http_request_duration_seconds observations', async () => {
    recordHttpRequestDuration({ endpoint: '/api/chat', method: 'POST', tenant_id: 'tenant-1' }, 0.123);

    const metrics = await register.metrics();
    expect(metrics).toContain('http_request_duration_seconds_bucket');
    expect(metrics).toContain('endpoint="/api/chat"');
    expect(metrics).toContain('tenant_id="tenant-1"');
  });

  it('sets chat_circuit_breaker_state gauge', async () => {
    setCircuitBreakerState('tenant-1', 0);
    setCircuitBreakerState('tenant-2', 1);

    const metrics = await register.metrics();
    expect(metrics).toContain('chat_circuit_breaker_state{tenant_id="tenant-1"} 0');
    expect(metrics).toContain('chat_circuit_breaker_state{tenant_id="tenant-2"} 1');
  });

  it('increments chat_requests_total with tenant and status labels', async () => {
    recordChatRequest('tenant-1', 'success');
    recordChatRequest('tenant-1', 'error');

    const metrics = await register.metrics();
    expect(metrics).toContain('chat_requests_total{tenant_id="tenant-1",status="success"} 1');
    expect(metrics).toContain('chat_requests_total{tenant_id="tenant-1",status="error"} 1');
  });

  it('records chat_request_duration_seconds observations', async () => {
    recordChatRequestDuration('tenant-1', 'success', 0.123);

    const metrics = await register.metrics();
    expect(metrics).toContain('chat_request_duration_seconds_bucket');
    expect(metrics).toContain('tenant_id="tenant-1"');
    expect(metrics).toContain('status="success"');
  });

  it('increments chat_errors_total with tenant and error_type labels', async () => {
    recordChatError('tenant-1', 'anthropic_error');

    const metrics = await register.metrics();
    expect(metrics).toContain('chat_errors_total{tenant_id="tenant-1",error_type="anthropic_error"} 1');
  });

  it('increments api_data_exposure_total with tenant and source labels', async () => {
    recordApiDataExposure('tenant-1', 'oversized_payload');

    const metrics = await register.metrics();
    expect(metrics).toContain('api_data_exposure_total{tenant_id="tenant-1",source="oversized_payload"} 1');
  });

  it('increments rsc_prefetch_total with route and status labels', async () => {
    recordRscPrefetch('/dashboard', 'success');

    const metrics = await register.metrics();
    expect(metrics).toContain('rsc_prefetch_total{route="/dashboard",status="success"} 1');
  });

  it('increments rate_limit_requests_total with tenant, route and decision labels', async () => {
    recordRateLimitRequest('tenant-1', '/api/chat', 'allowed');

    const metrics = await register.metrics();
    expect(metrics).toContain('rate_limit_requests_total{tenant_id="tenant-1",route="/api/chat",decision="allowed"} 1');
  });

  it('increments audit_events_total with tenant, action, result and severity labels', async () => {
    recordAuditEvent('tenant-1', 'login', 'success', 'INFO');

    const metrics = await register.metrics();
    expect(metrics).toContain('audit_events_total{tenant_id="tenant-1",action="login",result="success",severity="INFO"} 1');
  });
});
