import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditServiceClient } from './supabase/service';

export interface AuditActor {
  user_id: string;
  tenant_id: string;
}

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  resource: string;
  result: string;
  correlation_id?: string;
  severity: AuditSeverity;
  ip?: string;
  details?: Record<string, unknown>;
}

export interface EmitOptions {
  /** Salt for IP hashing. Falls back to AUDIT_IP_SALT env var. */
  salt?: string;
}

async function digestSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  return digestSha256(`${salt}:${ip}`);
}

export async function emitAudit(
  _client: SupabaseClient,
  event: AuditEvent,
  options: EmitOptions = {}
): Promise<void> {
  const salt = options.salt ?? process.env.AUDIT_IP_SALT;
  if (!salt) {
    throw new Error('AUDIT_IP_SALT is required to hash audit IP addresses');
  }

  const row = {
    actor_user_id: event.actor.user_id === 'anonymous' ? null : event.actor.user_id,
    actor_tenant_id: event.actor.tenant_id,
    action: event.action,
    resource: event.resource,
    result: event.result,
    correlation_id: event.correlation_id ?? null,
    severity: event.severity,
    ip_hash: event.ip ? await hashIp(event.ip, salt) : null,
    details: event.details ?? {},
  };

  const serviceClient = createAuditServiceClient();
  const { error } = await serviceClient.rpc('record_audit_log', {
    p_actor_user_id: row.actor_user_id,
    p_actor_tenant_id: row.actor_tenant_id,
    p_action: row.action,
    p_resource: row.resource,
    p_result: row.result,
    p_correlation_id: row.correlation_id,
    p_severity: row.severity,
    p_ip_hash: row.ip_hash,
    p_details: row.details,
  });
  if (error) {
    throw new Error(`Failed to emit audit event: ${error.message}`);
  }
}
