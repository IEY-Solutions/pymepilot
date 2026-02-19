---
name: api-resilience
description: Circuit breaker, exponential backoff y fallback strategies
---

\# Skill: API Resilience

\#\# 🎯 Qué es  
Patrones de resiliencia para integraciones con APIs externas. Circuit breaker, exponential backoff, timeout handling, rate limiting client-side, connection pooling, fallback strategies, y health checks.

\*\*Analogía Simple:\*\*  
Resiliencia es como sistemas de seguridad en un edificio:  
\- Circuit breaker \= cortar electricidad si hay sobrecarga  
\- Timeout \= alarma de incendio (no esperar indefinido)  
\- Retry con backoff \= intentar abrir puerta atascada, esperando más cada vez  
\- Fallback \= salida de emergencia alternativa  
\- Health check \= inspector que verifica todo funciona

En PymePilot:  
\- API de WhatsApp caída → usar cache \+ queue  
\- Kommo lento → timeout y retry  
\- Claude API rate limited → exponential backoff  
\- Circuit breaker → dejar de intentar si falla mucho

\*\*Por qué es CRÍTICO:\*\*  
\- Availability: app funciona aunque APIs fallen  
\- Performance: no esperar respuestas lentas  
\- Cost: no gastar requests en APIs caídas  
\- UX: degradación graceful, no crashes

\#\# 📋 Patterns Core

\#\#\# Pattern 1: Exponential Backoff

\*\*Cuándo usar:\*\*  
\- Transient errors (network glitches, timeouts)  
\- Rate limiting (429)  
\- Server errors (5xx)

\*\*Cómo funciona:\*\*  
\`\`\`  
Attempt 1: inmediato  
Attempt 2: esperar 1s  (2^0 \* 1000ms)  
Attempt 3: esperar 2s  (2^1 \* 1000ms)  
Attempt 4: esperar 4s  (2^2 \* 1000ms)  
Attempt 5: esperar 8s  (2^3 \* 1000ms)  
Max: 3-5 intentos  
\`\`\`

\*\*Implementación:\*\*  
\`\`\`typescript  
interface RetryConfig {  
  maxRetries: number  
  baseDelayMs: number  
  maxDelayMs?: number  
  retryableErrors?: string\[\]  
}

async function fetchWithRetry\<T\>(  
  fn: () \=\> Promise\<T\>,  
  config: RetryConfig  
): Promise\<T\> {  
  const {  
    maxRetries,  
    baseDelayMs,  
    maxDelayMs \= 30000, // 30s max  
    retryableErrors \= \['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'\]  
  } \= config  
    
  let lastError: Error  
    
  for (let attempt \= 0; attempt \< maxRetries; attempt++) {  
    try {  
      return await fn()  
        
    } catch (error: any) {  
      lastError \= error  
        
      // Check si error es retryable  
      const isRetryable \=   
        retryableErrors.includes(error.code) ||  
        error.status \=== 429 || // Rate limit  
        (error.status \>= 500 && error.status \< 600\) // Server errors  
        
      if (\!isRetryable || attempt \=== maxRetries \- 1\) {  
        throw error  
      }  
        
      // Exponential backoff con jitter  
      const exponentialDelay \= Math.min(  
        baseDelayMs \* Math.pow(2, attempt),  
        maxDelayMs  
      )  
        
      // Jitter: \+/- 25% random  
      const jitter \= exponentialDelay \* 0.25 \* (Math.random() \- 0.5)  
      const delayMs \= Math.floor(exponentialDelay \+ jitter)  
        
      console.log(  
        \`Attempt ${attempt \+ 1}/${maxRetries} failed: ${error.message}. \` \+  
        \`Retrying in ${delayMs}ms...\`  
      )  
        
      await sleep(delayMs)  
    }  
  }  
    
  throw lastError\!  
}

function sleep(ms: number): Promise\<void\> {  
  return new Promise(resolve \=\> setTimeout(resolve, ms))  
}

// Uso  
const data \= await fetchWithRetry(  
  async () \=\> {  
    const response \= await fetch('https://api.example.com/data')  
    if (\!response.ok) {  
      const error: any \= new Error(\`HTTP ${response.status}\`)  
      error.status \= response.status  
      throw error  
    }  
    return response.json()  
  },  
  {  
    maxRetries: 5,  
    baseDelayMs: 1000,  
    maxDelayMs: 30000  
  }  
)  
\`\`\`

\#\#\# Pattern 2: Circuit Breaker

\*\*Cuándo usar:\*\*  
\- API externa con failures frecuentes  
\- Evitar sobrecarga de API ya caída  
\- Fail fast cuando sabés que API está caída

\*\*Estados:\*\*  
\`\`\`  
CLOSED (normal)  
   ↓ (failures \> threshold)  
OPEN (rechaza requests inmediatamente)  
   ↓ (después de timeout)  
HALF\_OPEN (prueba 1 request)  
   ↓ success → CLOSED  
   ↓ failure → OPEN  
\`\`\`

\*\*Implementación:\*\*  
\`\`\`typescript  
enum CircuitState {  
  CLOSED \= 'CLOSED',  
  OPEN \= 'OPEN',  
  HALF\_OPEN \= 'HALF\_OPEN'  
}

interface CircuitBreakerConfig {  
  failureThreshold: number      // Fallos para abrir (ej: 5\)  
  failureThresholdPercentage: number // % de fallos (ej: 50%)  
  successThreshold: number       // Éxitos para cerrar desde half-open  
  timeout: number                // ms antes de pasar a half-open  
  volumeThreshold: number        // Requests mínimos para calcular %  
}

class CircuitBreaker {  
  private state: CircuitState \= CircuitState.CLOSED  
  private failures: number \= 0  
  private successes: number \= 0  
  private totalRequests: number \= 0  
  private lastFailureTime: number \= 0  
  private nextAttemptTime: number \= 0  
    
  constructor(  
    private name: string,  
    private config: CircuitBreakerConfig  
  ) {}  
    
  async execute\<T\>(fn: () \=\> Promise\<T\>): Promise\<T\> {  
    // Check estado  
    if (this.state \=== CircuitState.OPEN) {  
      if (Date.now() \< this.nextAttemptTime) {  
        throw new Error(\`Circuit breaker ${this.name} is OPEN\`)  
      }  
        
      // Timeout alcanzado → pasar a half-open  
      this.state \= CircuitState.HALF\_OPEN  
      console.log(\`Circuit breaker ${this.name} → HALF\_OPEN\`)  
    }  
      
    try {  
      const result \= await fn()  
      this.onSuccess()  
      return result  
        
    } catch (error) {  
      this.onFailure()  
      throw error  
    }  
  }  
    
  private onSuccess() {  
    this.totalRequests++  
    this.successes++  
      
    if (this.state \=== CircuitState.HALF\_OPEN) {  
      if (this.successes \>= this.config.successThreshold) {  
        // Suficientes éxitos → cerrar circuito  
        this.state \= CircuitState.CLOSED  
        this.reset()  
        console.log(\`Circuit breaker ${this.name} → CLOSED\`)  
      }  
    }  
  }  
    
  private onFailure() {  
    this.totalRequests++  
    this.failures++  
    this.lastFailureTime \= Date.now()  
      
    if (this.state \=== CircuitState.HALF\_OPEN) {  
      // Fallo en half-open → abrir de nuevo  
      this.open()  
      return  
    }  
      
    if (this.state \=== CircuitState.CLOSED) {  
      // Check si alcanzamos threshold  
      if (this.totalRequests \>= this.config.volumeThreshold) {  
        const failureRate \= (this.failures / this.totalRequests) \* 100  
          
        if (  
          this.failures \>= this.config.failureThreshold ||  
          failureRate \>= this.config.failureThresholdPercentage  
        ) {  
          this.open()  
        }  
      }  
    }  
  }  
    
  private open() {  
    this.state \= CircuitState.OPEN  
    this.nextAttemptTime \= Date.now() \+ this.config.timeout  
      
    console.log(  
      \`Circuit breaker ${this.name} → OPEN \` \+  
      \`(${this.failures}/${this.totalRequests} failures, \` \+  
      \`${((this.failures / this.totalRequests) \* 100).toFixed(1)}%)\`  
    )  
  }  
    
  private reset() {  
    this.failures \= 0  
    this.successes \= 0  
    this.totalRequests \= 0  
  }  
    
  getState(): CircuitState {  
    return this.state  
  }  
    
  getStats() {  
    return {  
      state: this.state,  
      failures: this.failures,  
      successes: this.successes,  
      totalRequests: this.totalRequests,  
      failureRate: this.totalRequests \> 0   
        ? (this.failures / this.totalRequests) \* 100   
        : 0  
    }  
  }  
}

// Uso  
const whatsappCircuit \= new CircuitBreaker('whatsapp-api', {  
  failureThreshold: 5,  
  failureThresholdPercentage: 50,  
  successThreshold: 2,  
  timeout: 60000, // 1 minuto  
  volumeThreshold: 10  
})

async function sendWhatsAppMessage(phone: string, message: string) {  
  try {  
    return await whatsappCircuit.execute(async () \=\> {  
      const response \= await fetch('https://api.whatsapp.com/send', {  
        method: 'POST',  
        body: JSON.stringify({ phone, message })  
      })  
        
      if (\!response.ok) {  
        throw new Error(\`WhatsApp API error: ${response.status}\`)  
      }  
        
      return response.json()  
    })  
      
  } catch (error) {  
    console.error('WhatsApp send failed:', error)  
      
    // Fallback: guardar en queue para retry después  
    await saveToRetryQueue({ phone, message })  
      
    throw error  
  }  
}

// Monitorear estado  
setInterval(() \=\> {  
  const stats \= whatsappCircuit.getStats()  
  console.log('WhatsApp circuit breaker:', stats)  
}, 30000\) // cada 30s  
\`\`\`

\#\#\# Pattern 3: Timeout Handling

\*\*Implementación con AbortController:\*\*  
\`\`\`typescript  
async function fetchWithTimeout\<T\>(  
  url: string,  
  options: RequestInit \= {},  
  timeoutMs: number \= 30000  
): Promise\<T\> {  
  const controller \= new AbortController()  
  const timeoutId \= setTimeout(() \=\> controller.abort(), timeoutMs)  
    
  try {  
    const response \= await fetch(url, {  
      ...options,  
      signal: controller.signal  
    })  
      
    clearTimeout(timeoutId)  
      
    if (\!response.ok) {  
      throw new Error(\`HTTP ${response.status}\`)  
    }  
      
    return await response.json()  
      
  } catch (error: any) {  
    clearTimeout(timeoutId)  
      
    if (error.name \=== 'AbortError') {  
      throw new Error(\`Request timeout after ${timeoutMs}ms\`)  
    }  
      
    throw error  
  }  
}

// Timeout diferenciado por operación  
const TIMEOUTS \= {  
  read: 10000,    // 10s para lecturas  
  write: 30000,   // 30s para escrituras  
  batch: 60000    // 60s para batch operations  
}

async function getCustomer(id: string) {  
  return fetchWithTimeout(  
    \`https://api.example.com/customers/${id}\`,  
    { method: 'GET' },  
    TIMEOUTS.read  
  )  
}

async function createCustomer(data: any) {  
  return fetchWithTimeout(  
    'https://api.example.com/customers',  
    {   
      method: 'POST',  
      body: JSON.stringify(data)  
    },  
    TIMEOUTS.write  
  )  
}  
\`\`\`

\#\#\# Pattern 4: Rate Limiting (Client-Side)

\*\*Token Bucket Algorithm:\*\*  
\`\`\`typescript  
class RateLimiter {  
  private tokens: number  
  private lastRefill: number  
    
  constructor(  
    private capacity: number,      // Max tokens  
    private refillRate: number,    // Tokens per second  
    private name: string \= 'default'  
  ) {  
    this.tokens \= capacity  
    this.lastRefill \= Date.now()  
  }  
    
  async acquire(tokensNeeded: number \= 1): Promise\<void\> {  
    await this.refill()  
      
    if (this.tokens \>= tokensNeeded) {  
      this.tokens \-= tokensNeeded  
      return  
    }  
      
    // No hay suficientes tokens → esperar  
    const tokensShort \= tokensNeeded \- this.tokens  
    const waitTimeMs \= (tokensShort / this.refillRate) \* 1000  
      
    console.log(  
      \`Rate limiter ${this.name}: waiting ${waitTimeMs}ms \` \+  
      \`(need ${tokensNeeded}, have ${this.tokens})\`  
    )  
      
    await sleep(waitTimeMs)  
    await this.refill()  
      
    this.tokens \-= tokensNeeded  
  }  
    
  private async refill() {  
    const now \= Date.now()  
    const elapsedMs \= now \- this.lastRefill  
    const tokensToAdd \= (elapsedMs / 1000\) \* this.refillRate  
      
    this.tokens \= Math.min(this.capacity, this.tokens \+ tokensToAdd)  
    this.lastRefill \= now  
  }  
    
  getAvailableTokens(): number {  
    return Math.floor(this.tokens)  
  }  
}

// Uso  
const whatsappLimiter \= new RateLimiter(  
  1000,                    // 1000 mensajes máximo  
  1000 / (24 \* 3600),     // 1000 tokens / 24 horas \= 0.01157 tokens/sec  
  'whatsapp'  
)

async function sendWhatsAppMessageRateLimited(phone: string, message: string) {  
  // Esperar token  
  await whatsappLimiter.acquire(1)  
    
  // Enviar mensaje  
  return sendWhatsAppMessage(phone, message)  
}

// Batch con rate limiting  
async function sendBatchMessages(messages: Array\<{phone: string, text: string}\>) {  
  for (const msg of messages) {  
    await whatsappLimiter.acquire(1)  
    await sendWhatsAppMessage(msg.phone, msg.text)  
  }  
}  
\`\`\`

\#\#\# Pattern 5: Fallback Strategy

\*\*Niveles de fallback:\*\*  
\`\`\`typescript  
async function getCustomerData(customerId: string) {  
  try {  
    // Nivel 1: API primaria  
    return await fetchFromPrimaryAPI(customerId)  
      
  } catch (error) {  
    console.warn('Primary API failed, trying cache...', error)  
      
    try {  
      // Nivel 2: Cache  
      const cached \= await getFromCache(customerId)  
      if (cached) {  
        console.log('Serving from cache')  
        return cached  
      }  
        
    } catch (cacheError) {  
      console.warn('Cache failed:', cacheError)  
    }  
      
    try {  
      // Nivel 3: Database local  
      console.log('Trying local database...')  
      return await getFromLocalDB(customerId)  
        
    } catch (dbError) {  
      console.warn('Local DB failed:', dbError)  
    }  
      
    // Nivel 4: Default/empty data  
    console.error('All fallbacks failed, returning defaults')  
    return getDefaultCustomerData()  
  }  
}

function getDefaultCustomerData() {  
  return {  
    id: 'unknown',  
    name: 'Customer data unavailable',  
    status: 'unknown',  
    \_fallback: true  
  }  
}  
\`\`\`

\#\#\# Pattern 6: Health Checks  
\`\`\`typescript  
interface HealthCheckResult {  
  service: string  
  status: 'healthy' | 'degraded' | 'unhealthy'  
  latency?: number  
  error?: string  
  timestamp: string  
}

class HealthChecker {  
  private results: Map\<string, HealthCheckResult\> \= new Map()  
    
  async checkService(  
    name: string,  
    checkFn: () \=\> Promise\<void\>,  
    timeout: number \= 5000  
  ): Promise\<HealthCheckResult\> {  
    const startTime \= Date.now()  
      
    try {  
      await Promise.race(\[  
        checkFn(),  
        sleep(timeout).then(() \=\> { throw new Error('Timeout') })  
      \])  
        
      const latency \= Date.now() \- startTime  
        
      const result: HealthCheckResult \= {  
        service: name,  
        status: latency \< 1000 ? 'healthy' : 'degraded',  
        latency,  
        timestamp: new Date().toISOString()  
      }  
        
      this.results.set(name, result)  
      return result  
        
    } catch (error: any) {  
      const result: HealthCheckResult \= {  
        service: name,  
        status: 'unhealthy',  
        error: error.message,  
        timestamp: new Date().toISOString()  
      }  
        
      this.results.set(name, result)  
      return result  
    }  
  }  
    
  async checkAll(services: Map\<string, () \=\> Promise\<void\>\>): Promise\<HealthCheckResult\[\]\> {  
    const checks \= Array.from(services.entries()).map((\[name, checkFn\]) \=\>  
      this.checkService(name, checkFn)  
    )  
      
    return Promise.all(checks)  
  }  
    
  getStatus(serviceName: string): HealthCheckResult | undefined {  
    return this.results.get(serviceName)  
  }  
    
  getAllStatuses(): HealthCheckResult\[\] {  
    return Array.from(this.results.values())  
  }  
}

// Uso  
const healthChecker \= new HealthChecker()

// Health checks periódicos  
setInterval(async () \=\> {  
  const services \= new Map\<string, () \=\> Promise\<void\>\>(\[  
    \['whatsapp-api', async () \=\> {  
      const response \= await fetch('https://api.whatsapp.com/health')  
      if (\!response.ok) throw new Error('Unhealthy')  
    }\],  
    \['kommo-api', async () \=\> {  
      const response \= await fetch('https://api.kommo.com/health')  
      if (\!response.ok) throw new Error('Unhealthy')  
    }\],  
    \['database', async () \=\> {  
      await supabase.from('customers').select('id').limit(1)  
    }\]  
  \])  
    
  const results \= await healthChecker.checkAll(services)  
    
  results.forEach(result \=\> {  
    if (result.status \=== 'unhealthy') {  
      console.error(\`⚠️ ${result.service} is UNHEALTHY:\`, result.error)  
      // Enviar alerta  
    } else if (result.status \=== 'degraded') {  
      console.warn(\`⚠️ ${result.service} is DEGRADED (latency: ${result.latency}ms)\`)  
    } else {  
      console.log(\`✅ ${result.service} is healthy (latency: ${result.latency}ms)\`)  
    }  
  })  
}, 60000\) // cada 1 minuto

// Endpoint de health para monitoring externo  
serve(async (req) \=\> {  
  if (req.url.endsWith('/health')) {  
    const statuses \= healthChecker.getAllStatuses()  
    const overallHealthy \= statuses.every(s \=\> s.status \!== 'unhealthy')  
      
    return new Response(JSON.stringify({  
      status: overallHealthy ? 'healthy' : 'unhealthy',  
      services: statuses  
    }), {  
      status: overallHealthy ? 200 : 503,  
      headers: { 'Content-Type': 'application/json' }  
    })  
  }  
})  
\`\`\`

\#\# 💻 Complete Resilient API Client  
\`\`\`typescript  
class ResilientAPIClient {  
  private circuitBreaker: CircuitBreaker  
  private rateLimiter: RateLimiter  
    
  constructor(  
    private baseURL: string,  
    private defaultTimeout: number \= 30000  
  ) {  
    this.circuitBreaker \= new CircuitBreaker('api-client', {  
      failureThreshold: 5,  
      failureThresholdPercentage: 50,  
      successThreshold: 2,  
      timeout: 60000,  
      volumeThreshold: 10  
    })  
      
    this.rateLimiter \= new RateLimiter(100, 100 / 60, 'api-client') // 100 req/min  
  }  
    
  async request\<T\>(config: {  
    endpoint: string  
    method: string  
    body?: any  
    timeout?: number  
    retries?: number  
  }): Promise\<T\> {  
    // 1\. Rate limiting  
    await this.rateLimiter.acquire(1)  
      
    // 2\. Circuit breaker  
    return await this.circuitBreaker.execute(async () \=\> {  
      // 3\. Retry con exponential backoff  
      return await fetchWithRetry(  
        async () \=\> {  
          // 4\. Timeout  
          return await fetchWithTimeout\<T\>(  
            \`${this.baseURL}${config.endpoint}\`,  
            {  
              method: config.method,  
              body: config.body ? JSON.stringify(config.body) : undefined,  
              headers: { 'Content-Type': 'application/json' }  
            },  
            config.timeout || this.defaultTimeout  
          )  
        },  
        {  
          maxRetries: config.retries || 3,  
          baseDelayMs: 1000,  
          maxDelayMs: 30000  
        }  
      )  
    })  
  }  
}

// Uso  
const client \= new ResilientAPIClient('https://api.example.com')

try {  
  const customer \= await client.request({  
    endpoint: '/customers/123',  
    method: 'GET',  
    timeout: 10000  
  })  
} catch (error) {  
  // Fallback  
  const customer \= await getFromCache('customer-123')  
}  
\`\`\`

\#\# ✅ Checklist

\- \[ \] Exponential backoff implementado  
\- \[ \] Circuit breaker configurado  
\- \[ \] Timeout en todas las requests  
\- \[ \] Rate limiting client-side  
\- \[ \] Fallback strategy definida  
\- \[ \] Health checks periódicos  
\- \[ \] Logging de errores con contexto  
\- \[ \] Alertas para circuit breaker open  
\- \[ \] Metrics (latency, error rate, etc.)

\---  
