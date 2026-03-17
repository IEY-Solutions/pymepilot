---
name: webhook-architecture
description: Receivers seguros con HMAC signature e idempotency
---

\# Skill: Webhook Architecture

\#\# 🎯 Qué es  
Arquitectura completa para recibir y procesar webhooks de APIs externas. Signature validation, idempotency, replay prevention, async processing, retry logic, y dead letter queues.

\*\*Analogía Simple:\*\*  
Webhooks son como notificaciones push de apps en tu teléfono:  
\- Signature \= verificar que la notificación es legítima  
\- Idempotency \= no procesar la misma notificación dos veces  
\- Replay prevention \= ignorar notificaciones viejas  
\- Async processing \= no bloquear mientras procesas  
\- Retry \= reintentar si falla el procesamiento

En PymePilot:  
\- Kommo envía webhook cuando nuevo lead  
\- WhatsApp envía webhook de status (delivered, read)  
\- Stripe envía webhook de pagos  
\- Validar SIEMPRE antes de confiar

\*\*Por qué es CRÍTICO:\*\*  
\- Seguridad: webhooks pueden ser forjados  
\- Reliability: webhooks pueden duplicarse  
\- Performance: procesar async (no bloquear sender)  
\- Debugging: logging completo de payloads

\#\# 📋 Componentes Core

\#\#\# Component 1: Signature Validation (HMAC)

\*\*Cómo funciona HMAC:\*\*  
\`\`\`  
1\. API provider calcula: HMAC-SHA256(payload, secret)  
2\. Envía signature en header  
3\. Tu servidor recalcula: HMAC-SHA256(payload, secret)  
4\. Compara: tu signature \=== received signature  
5\. Si match → legítimo, sino → forjado  
\`\`\`

\*\*Implementación:\*\*  
\`\`\`typescript  
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

function validateHMACSignature(  
  payload: string,  
  receivedSignature: string,  
  secret: string,  
  algorithm: 'sha256' | 'sha1' \= 'sha256'  
): boolean {  
  // Calcular signature esperado  
  const expectedSignature \= createHmac(algorithm, secret)  
    .update(payload)  
    .digest('hex')  
    
  // Comparación timing-safe (previene timing attacks)  
  return timingSafeEqual(  
    Buffer.from(receivedSignature),  
    Buffer.from(expectedSignature)  
  )  
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {  
  if (a.length \!== b.length) return false  
    
  let result \= 0  
  for (let i \= 0; i \< a.length; i++) {  
    result |= a\[i\] ^ b\[i\]  
  }  
    
  return result \=== 0  
}

// Uso en webhook receiver  
serve(async (req) \=\> {  
  const body \= await req.text()  
  const signature \= req.headers.get('X-Signature') // Header varía por provider  
    
  if (\!signature) {  
    console.error('Missing signature header')  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  const secret \= Deno.env.get('WEBHOOK\_SECRET')\!  
  const isValid \= validateHMACSignature(body, signature, secret)  
    
  if (\!isValid) {  
    console.error('Invalid signature')  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  // Signature válido → procesar  
  const payload \= JSON.parse(body)  
  await processWebhook(payload)  
    
  return new Response('OK', { status: 200 })  
})  
\`\`\`

\*\*Variantes por provider:\*\*  
\`\`\`typescript  
// Stripe: signature en formato especial  
function validateStripeSignature(  
  payload: string,  
  signatureHeader: string,  
  secret: string  
): boolean {  
  // Stripe envía: t=timestamp,v1=signature1,v1=signature2  
  const elements \= signatureHeader.split(',')  
  const timestamp \= elements.find(e \=\> e.startsWith('t='))?.split('=')\[1\]  
  const signatures \= elements.filter(e \=\> e.startsWith('v1='))  
    .map(e \=\> e.split('=')\[1\])  
    
  if (\!timestamp || signatures.length \=== 0\) return false  
    
  // Crear payload signed: timestamp.payload  
  const signedPayload \= \`${timestamp}.${payload}\`  
    
  const expectedSignature \= createHmac('sha256', secret)  
    .update(signedPayload)  
    .digest('hex')  
    
  // Check si alguna signature match  
  return signatures.some(sig \=\> timingSafeEqual(  
    Buffer.from(sig),  
    Buffer.from(expectedSignature)  
  ))  
}

// GitHub: signature con prefijo "sha256="  
function validateGitHubSignature(  
  payload: string,  
  signatureHeader: string,  
  secret: string  
): boolean {  
  // Header: "sha256=abc123..."  
  const receivedSignature \= signatureHeader.replace('sha256=', '')  
    
  const expectedSignature \= createHmac('sha256', secret)  
    .update(payload)  
    .digest('hex')  
    
  return timingSafeEqual(  
    Buffer.from(receivedSignature),  
    Buffer.from(expectedSignature)  
  )  
}

// Shopify: Base64-encoded HMAC  
function validateShopifySignature(  
  payload: string,  
  signatureHeader: string,  
  secret: string  
): boolean {  
  const expectedSignature \= createHmac('sha256', secret)  
    .update(payload)  
    .digest('base64')  
    
  return signatureHeader \=== expectedSignature  
}  
\`\`\`

\#\#\# Component 2: Idempotency (evitar duplicados)

\*\*Por qué se duplican webhooks:\*\*  
\- Network retries del sender  
\- Sender reenvía si no recibe 200 rápido  
\- Fallos parciales (procesaste pero no respondiste 200\)

\*\*Implementación:\*\*  
\`\`\`typescript  
interface ProcessedWebhook {  
  webhook\_id: string  
  payload: any  
  processed\_at: string  
  status: 'success' | 'failed'  
}

async function processWebhookIdempotent(payload: any): Promise\<boolean\> {  
  const webhookId \= extractWebhookId(payload)  
    
  // Check si ya procesado  
  const { data: existing } \= await supabase  
    .from('processed\_webhooks')  
    .select('id, status')  
    .eq('webhook\_id', webhookId)  
    .single()  
    
  if (existing) {  
    console.log('Webhook already processed:', webhookId, 'status:', existing.status)  
    return true // Retornar success aunque sea duplicado  
  }  
    
  // Marcar como procesando (atomic lock)  
  const { error: lockError } \= await supabase  
    .from('processed\_webhooks')  
    .insert({  
      webhook\_id: webhookId,  
      payload: payload,  
      status: 'processing',  
      started\_at: new Date().toISOString()  
    })  
    
  if (lockError) {  
    // Otro proceso ya está procesando (race condition)  
    console.log('Webhook being processed by another worker:', webhookId)  
    return true  
  }  
    
  try {  
    // Procesar webhook  
    await actualWebhookProcessing(payload)  
      
    // Marcar como exitoso  
    await supabase  
      .from('processed\_webhooks')  
      .update({  
        status: 'success',  
        processed\_at: new Date().toISOString()  
      })  
      .eq('webhook\_id', webhookId)  
      
    return true  
      
  } catch (error) {  
    console.error('Webhook processing failed:', error)  
      
    // Marcar como fallido  
    await supabase  
      .from('processed\_webhooks')  
      .update({  
        status: 'failed',  
        error\_message: error.message,  
        processed\_at: new Date().toISOString()  
      })  
      .eq('webhook\_id', webhookId)  
      
    return false  
  }  
}

function extractWebhookId(payload: any): string {  
  // Diferentes providers usan diferentes campos  
  return payload.id ||   
         payload.event\_id ||   
         payload.webhook\_id ||  
         payload.message\_id ||  
         // Fallback: hash del payload completo  
         createHash('sha256').update(JSON.stringify(payload)).digest('hex')  
}  
\`\`\`

\*\*Database schema:\*\*  
\`\`\`sql  
CREATE TABLE processed\_webhooks (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  webhook\_id TEXT UNIQUE NOT NULL,  
  provider TEXT NOT NULL, \-- 'stripe', 'kommo', etc.  
  event\_type TEXT,        \-- 'payment.succeeded', etc.  
  payload JSONB NOT NULL,  
  status TEXT NOT NULL,   \-- 'processing', 'success', 'failed'  
  error\_message TEXT,  
  started\_at TIMESTAMPTZ,  
  processed\_at TIMESTAMPTZ,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

CREATE INDEX idx\_processed\_webhooks\_webhook\_id ON processed\_webhooks(webhook\_id);  
CREATE INDEX idx\_processed\_webhooks\_created\_at ON processed\_webhooks(created\_at);

\-- Auto-delete old webhooks (después de 90 días)  
CREATE OR REPLACE FUNCTION delete\_old\_processed\_webhooks()  
RETURNS void AS $$  
BEGIN  
  DELETE FROM processed\_webhooks   
  WHERE created\_at \< NOW() \- INTERVAL '90 days';  
END;  
$$ LANGUAGE plpgsql;  
\`\`\`

\#\#\# Component 3: Replay Prevention (timestamp validation)

\*\*Por qué es necesario:\*\*  
\- Atacante captura webhook legítimo  
\- Lo reenvía días después  
\- Sin timestamp validation → se procesa de nuevo

\*\*Implementación:\*\*  
\`\`\`typescript  
function validateWebhookTimestamp(  
  timestamp: number,  
  maxAgeMs: number \= 5 \* 60 \* 1000 // 5 minutos default  
): void {  
  const now \= Date.now()  
  const age \= now \- timestamp  
    
  // Timestamp muy viejo  
  if (age \> maxAgeMs) {  
    throw new Error(\`Webhook too old: ${age}ms (max: ${maxAgeMs}ms)\`)  
  }  
    
  // Timestamp en el futuro (clock skew o forjado)  
  if (age \< \-60000) { // 1 minuto de tolerancia para clock skew  
    throw new Error('Webhook timestamp in future')  
  }  
}

// Uso en webhook receiver  
serve(async (req) \=\> {  
  const body \= await req.text()  
  const payload \= JSON.parse(body)  
    
  // Validar signature  
  const signature \= req.headers.get('X-Signature')\!  
  if (\!validateHMACSignature(body, signature, secret)) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  // Validar timestamp (replay prevention)  
  try {  
    const timestamp \= payload.timestamp || payload.created\_at  
    if (timestamp) {  
      validateWebhookTimestamp(  
        typeof timestamp \=== 'string' ? Date.parse(timestamp) : timestamp \* 1000,  
        5 \* 60 \* 1000 // 5 minutos max age  
      )  
    }  
  } catch (error) {  
    console.error('Timestamp validation failed:', error)  
    return new Response('Invalid timestamp', { status: 400 })  
  }  
    
  // Procesar  
  await processWebhook(payload)  
    
  return new Response('OK', { status: 200 })  
})  
\`\`\`

\#\#\# Component 4: Async Processing (no bloquear sender)

\*\*Pattern: Return 200 inmediatamente, procesar async\*\*  
\`\`\`typescript  
serve(async (req) \=\> {  
  const body \= await req.text()  
  const signature \= req.headers.get('X-Signature')\!  
    
  // Validaciones síncronas (rápidas)  
  if (\!validateHMACSignature(body, signature, secret)) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  const payload \= JSON.parse(body)  
    
  // Check idempotency  
  const webhookId \= extractWebhookId(payload)  
  const { data: existing } \= await supabase  
    .from('processed\_webhooks')  
    .select('id')  
    .eq('webhook\_id', webhookId)  
    .single()  
    
  if (existing) {  
    // Ya procesado → return 200 inmediatamente  
    return new Response('OK', { status: 200 })  
  }  
    
  // Guardar en queue para procesamiento async  
  await supabase.from('webhook\_queue').insert({  
    webhook\_id: webhookId,  
    provider: 'kommo',  
    event\_type: payload.event\_type,  
    payload: payload,  
    status: 'pending'  
  })  
    
  // Return 200 ANTES de procesar (sender no espera)  
  // Processing se hace en background job  
  return new Response('OK', { status: 200 })  
})

// Background worker (cron job cada 1 minuto)  
async function processWebhookQueue() {  
  const { data: pendingWebhooks } \= await supabase  
    .from('webhook\_queue')  
    .select('\*')  
    .eq('status', 'pending')  
    .order('created\_at', { ascending: true })  
    .limit(100)  
    
  for (const webhook of pendingWebhooks || \[\]) {  
    try {  
      // Marcar como processing  
      await supabase  
        .from('webhook\_queue')  
        .update({ status: 'processing' })  
        .eq('id', webhook.id)  
        
      // Procesar  
      await actualWebhookProcessing(webhook.payload)  
        
      // Marcar como completado  
      await supabase  
        .from('webhook\_queue')  
        .update({   
          status: 'completed',  
          processed\_at: new Date().toISOString()  
        })  
        .eq('id', webhook.id)  
        
    } catch (error) {  
      console.error('Webhook processing failed:', error)  
        
      // Incrementar retry count  
      const retryCount \= (webhook.retry\_count || 0\) \+ 1  
        
      if (retryCount \>= 3\) {  
        // Max retries alcanzado → dead letter queue  
        await supabase  
          .from('webhook\_queue')  
          .update({   
            status: 'failed',  
            error\_message: error.message,  
            retry\_count: retryCount  
          })  
          .eq('id', webhook.id)  
      } else {  
        // Retry después  
        await supabase  
          .from('webhook\_queue')  
          .update({   
            status: 'pending',  
            retry\_count: retryCount,  
            next\_retry\_at: new Date(Date.now() \+ Math.pow(2, retryCount) \* 60000\) // Exponential backoff  
          })  
          .eq('id', webhook.id)  
      }  
    }  
  }  
}  
\`\`\`

\*\*Database schema:\*\*  
\`\`\`sql  
CREATE TABLE webhook\_queue (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  webhook\_id TEXT UNIQUE NOT NULL,  
  provider TEXT NOT NULL,  
  event\_type TEXT,  
  payload JSONB NOT NULL,  
  status TEXT NOT NULL, \-- 'pending', 'processing', 'completed', 'failed'  
  retry\_count INT DEFAULT 0,  
  next\_retry\_at TIMESTAMPTZ,  
  error\_message TEXT,  
  processed\_at TIMESTAMPTZ,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

CREATE INDEX idx\_webhook\_queue\_status ON webhook\_queue(status);  
CREATE INDEX idx\_webhook\_queue\_next\_retry ON webhook\_queue(next\_retry\_at) WHERE status \= 'pending';  
\`\`\`

\#\#\# Component 5: Retry Logic con Exponential Backoff  
\`\`\`typescript  
async function processWithRetry(  
  fn: () \=\> Promise\<void\>,  
  maxRetries: number \= 3,  
  baseDelayMs: number \= 1000  
): Promise\<void\> {  
  let lastError: Error  
    
  for (let attempt \= 0; attempt \< maxRetries; attempt++) {  
    try {  
      await fn()  
      return // Success  
        
    } catch (error) {  
      lastError \= error  
        
      if (attempt \< maxRetries \- 1\) {  
        // Exponential backoff: 1s, 2s, 4s, 8s...  
        const delayMs \= baseDelayMs \* Math.pow(2, attempt)  
          
        console.log(\`Attempt ${attempt \+ 1} failed, retrying in ${delayMs}ms...\`)  
          
        await new Promise(resolve \=\> setTimeout(resolve, delayMs))  
      }  
    }  
  }  
    
  throw new Error(\`Failed after ${maxRetries} attempts: ${lastError.message}\`)  
}

// Uso  
await processWithRetry(async () \=\> {  
  await actualWebhookProcessing(payload)  
}, 3, 1000\)  
\`\`\`

\#\#\# Component 6: Dead Letter Queue (DLQ)  
\`\`\`typescript  
async function moveToDeadLetterQueue(webhook: any, error: Error) {  
  await supabase.from('webhook\_dead\_letter\_queue').insert({  
    webhook\_id: webhook.webhook\_id,  
    provider: webhook.provider,  
    event\_type: webhook.event\_type,  
    payload: webhook.payload,  
    error\_message: error.message,  
    retry\_count: webhook.retry\_count,  
    original\_created\_at: webhook.created\_at  
  })  
    
  // Alertar a admin  
  await sendAdminAlert({  
    type: 'webhook\_dlq',  
    message: \`Webhook ${webhook.webhook\_id} moved to DLQ after ${webhook.retry\_count} retries\`,  
    error: error.message  
  })  
}  
\`\`\`

\#\# 🔍 Complete Webhook Receiver Template  
\`\`\`typescript  
// supabase/functions/webhook-receiver/index.ts  
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'  
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const supabase \= createClient(  
  Deno.env.get('SUPABASE\_URL')\!,  
  Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
)

serve(async (req) \=\> {  
  try {  
    // 1\. Get raw body  
    const body \= await req.text()  
      
    // 2\. Validate signature  
    const signature \= req.headers.get('X-Webhook-Signature')  
    if (\!signature) {  
      console.error('Missing signature header')  
      return new Response('Unauthorized', { status: 401 })  
    }  
      
    const secret \= Deno.env.get('WEBHOOK\_SECRET')\!  
    const isValidSignature \= validateHMACSignature(body, signature, secret)  
      
    if (\!isValidSignature) {  
      console.error('Invalid signature')  
      return new Response('Unauthorized', { status: 401 })  
    }  
      
    // 3\. Parse payload  
    const payload \= JSON.parse(body)  
      
    // 4\. Validate timestamp (replay prevention)  
    if (payload.timestamp) {  
      const timestamp \= typeof payload.timestamp \=== 'string'   
        ? Date.parse(payload.timestamp)   
        : payload.timestamp \* 1000  
        
      validateWebhookTimestamp(timestamp, 5 \* 60 \* 1000\)  
    }  
      
    // 5\. Check idempotency  
    const webhookId \= extractWebhookId(payload)  
    const { data: existing } \= await supabase  
      .from('processed\_webhooks')  
      .select('id')  
      .eq('webhook\_id', webhookId)  
      .single()  
      
    if (existing) {  
      console.log('Webhook already processed:', webhookId)  
      return new Response('OK', { status: 200 })  
    }  
      
    // 6\. Queue for async processing  
    await supabase.from('webhook\_queue').insert({  
      webhook\_id: webhookId,  
      provider: 'provider-name',  
      event\_type: payload.event || payload.type,  
      payload: payload,  
      status: 'pending'  
    })  
      
    console.log('Webhook queued:', webhookId)  
      
    // 7\. Return 200 immediately  
    return new Response('OK', { status: 200 })  
      
  } catch (error) {  
    console.error('Webhook receiver error:', error)  
      
    // CRITICAL: Always return 200 to prevent retries  
    // Log error for investigation  
    return new Response('OK', { status: 200 })  
  }  
})

function validateHMACSignature(payload: string, signature: string, secret: string): boolean {  
  const expectedSignature \= createHmac('sha256', secret)  
    .update(payload)  
    .digest('hex')  
    
  return signature \=== expectedSignature  
}

function validateWebhookTimestamp(timestamp: number, maxAge: number): void {  
  const now \= Date.now()  
  const age \= now \- timestamp  
    
  if (age \> maxAge) {  
    throw new Error(\`Webhook too old: ${age}ms\`)  
  }  
    
  if (age \< \-60000) {  
    throw new Error('Webhook timestamp in future')  
  }  
}

function extractWebhookId(payload: any): string {  
  return payload.id || payload.event\_id || payload.webhook\_id ||  
         createHash('sha256').update(JSON.stringify(payload)).digest('hex')  
}  
\`\`\`

\#\# ✅ Checklist

\- \[ \] HMAC signature validation  
\- \[ \] Timing-safe comparison  
\- \[ \] Idempotency check (DB)  
\- \[ \] Timestamp validation (replay prevention)  
\- \[ \] Return 200 immediately (async processing)  
\- \[ \] Webhook queue table  
\- \[ \] Retry logic con exponential backoff  
\- \[ \] Dead letter queue  
\- \[ \] Logging completo (payloads sin secrets)  
\- \[ \] Admin alerts para failures

\---  
