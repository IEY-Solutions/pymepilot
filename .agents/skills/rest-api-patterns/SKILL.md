---
name: rest-api-patterns
description: Consumo de REST APIs con pagination, retry y error handling
---

\# Skill: REST API Patterns

\#\# 🎯 Qué es  
Patrones y best practices para consumir REST APIs. HTTP methods, headers, authentication, pagination, error handling, retries, timeouts, y rate limiting client-side.

\*\*Analogía Simple:\*\*  
REST API es como un menú de restaurant:  
\- GET \= pedir ver el menú (leer)  
\- POST \= hacer un pedido nuevo (crear)  
\- PUT/PATCH \= modificar tu pedido (actualizar)  
\- DELETE \= cancelar pedido (eliminar)  
\- Headers \= preferencias especiales (idioma, alergias)  
\- Status codes \= respuesta del mesero (200 OK, 404 No encontrado)

En PymePilot:  
\- GET /customers → listar customers  
\- POST /customers → crear customer  
\- PATCH /customers/:id → actualizar customer  
\- DELETE /customers/:id → eliminar customer  
\- Pagination → traer de a páginas  
\- Rate limiting → no saturar el servidor

\*\*Por qué es CRÍTICO:\*\*  
\- Idempotency: requests repetidos no causan duplicados  
\- Error handling: fallos transitorios vs permanentes  
\- Pagination: no traer millones de registros  
\- Caching: reducir llamadas innecesarias

\#\# 📋 HTTP Methods

\#\#\# GET (Leer)

\*\*Características:\*\*  
\- Idempotente (múltiples calls \= mismo resultado)  
\- Cacheable  
\- No body en request  
\- Query params para filtros  
\`\`\`typescript  
async function getCustomers(filters?: {  
  status?: string  
  page?: number  
  limit?: number  
}) {  
  const params \= new URLSearchParams()  
    
  if (filters?.status) params.append('status', filters.status)  
  if (filters?.page) params.append('page', filters.page.toString())  
  if (filters?.limit) params.append('limit', filters.limit.toString())  
    
  const response \= await fetch(  
    \`https://api.example.com/customers?${params}\`,  
    {  
      method: 'GET',  
      headers: {  
        'Authorization': \`Bearer ${accessToken}\`,  
        'Accept': 'application/json'  
      }  
    }  
  )  
    
  if (\!response.ok) {  
    throw new Error(\`GET failed: ${response.status}\`)  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\#\# POST (Crear)

\*\*Características:\*\*  
\- NO idempotente (cada call crea nuevo recurso)  
\- Body en JSON  
\- Retorna 201 Created \+ Location header  
\`\`\`typescript  
async function createCustomer(customer: {  
  name: string  
  email: string  
  phone?: string  
}) {  
  const response \= await fetch('https://api.example.com/customers', {  
    method: 'POST',  
    headers: {  
      'Authorization': \`Bearer ${accessToken}\`,  
      'Content-Type': 'application/json',  
      'Accept': 'application/json'  
    },  
    body: JSON.stringify(customer)  
  })  
    
  if (\!response.ok) {  
    const error \= await response.json()  
    throw new Error(\`POST failed: ${error.message}\`)  
  }  
    
  // 201 Created  
  const created \= await response.json()  
  const location \= response.headers.get('Location')  
    
  return { data: created, location }  
}  
\`\`\`

\#\#\# PUT (Reemplazar completo)

\*\*Características:\*\*  
\- Idempotente  
\- Reemplaza recurso completo  
\- Debe enviar TODOS los campos  
\`\`\`typescript  
async function replaceCustomer(id: string, customer: {  
  name: string  
  email: string  
  phone: string  
  status: string  
}) {  
  const response \= await fetch(\`https://api.example.com/customers/${id}\`, {  
    method: 'PUT',  
    headers: {  
      'Authorization': \`Bearer ${accessToken}\`,  
      'Content-Type': 'application/json'  
    },  
    body: JSON.stringify(customer)  
  })  
    
  if (\!response.ok) {  
    throw new Error(\`PUT failed: ${response.status}\`)  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\#\# PATCH (Actualizar parcial)

\*\*Características:\*\*  
\- Idempotente  
\- Actualiza solo campos enviados  
\- Más eficiente que PUT  
\`\`\`typescript  
async function updateCustomer(id: string, updates: {  
  name?: string  
  email?: string  
  status?: string  
}) {  
  const response \= await fetch(\`https://api.example.com/customers/${id}\`, {  
    method: 'PATCH',  
    headers: {  
      'Authorization': \`Bearer ${accessToken}\`,  
      'Content-Type': 'application/json'  
    },  
    body: JSON.stringify(updates)  
  })  
    
  if (\!response.ok) {  
    throw new Error(\`PATCH failed: ${response.status}\`)  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\#\# DELETE (Eliminar)

\*\*Características:\*\*  
\- Idempotente  
\- 204 No Content (sin body) o 200 OK (con body)  
\- Segundo DELETE del mismo recurso → 404  
\`\`\`typescript  
async function deleteCustomer(id: string) {  
  const response \= await fetch(\`https://api.example.com/customers/${id}\`, {  
    method: 'DELETE',  
    headers: {  
      'Authorization': \`Bearer ${accessToken}\`  
    }  
  })  
    
  if (\!response.ok && response.status \!== 404\) {  
    throw new Error(\`DELETE failed: ${response.status}\`)  
  }  
    
  // 204 No Content \= success sin body  
  if (response.status \=== 204\) {  
    return { success: true }  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\# 🔄 Pagination Patterns

\#\#\# Pattern 1: Offset-based  
\`\`\`typescript  
interface PaginatedResponse\<T\> {  
  data: T\[\]  
  total: number  
  page: number  
  per\_page: number  
}

async function getCustomersWithOffset(  
  page: number \= 1,  
  perPage: number \= 20  
): Promise\<PaginatedResponse\<Customer\>\> {  
  const offset \= (page \- 1\) \* perPage  
    
  const params \= new URLSearchParams({  
    offset: offset.toString(),  
    limit: perPage.toString()  
  })  
    
  const response \= await fetch(\`https://api.example.com/customers?${params}\`)  
    
  return await response.json()  
}  
\`\`\`

\#\#\# Pattern 2: Cursor-based (mejor para datasets grandes)  
\`\`\`typescript  
interface CursorPaginatedResponse\<T\> {  
  data: T\[\]  
  next\_cursor: string | null  
  has\_more: boolean  
}

async function getCustomersWithCursor(  
  cursor?: string,  
  limit: number \= 20  
): Promise\<CursorPaginatedResponse\<Customer\>\> {  
  const params \= new URLSearchParams({ limit: limit.toString() })  
    
  if (cursor) {  
    params.append('cursor', cursor)  
  }  
    
  const response \= await fetch(\`https://api.example.com/customers?${params}\`)  
    
  return await response.json()  
}

// Iterar todas las páginas  
async function getAllCustomers(): Promise\<Customer\[\]\> {  
  const allCustomers: Customer\[\] \= \[\]  
  let cursor: string | null \= null  
    
  do {  
    const page \= await getCustomersWithCursor(cursor || undefined)  
    allCustomers.push(...page.data)  
    cursor \= page.next\_cursor  
  } while (cursor)  
    
  return allCustomers  
}  
\`\`\`

\#\#\# Pattern 3: Page-based (más simple)  
\`\`\`typescript  
async function getCustomersPage(page: number \= 1): Promise\<{  
  data: Customer\[\]  
  current\_page: number  
  total\_pages: number  
}\> {  
  const response \= await fetch(  
    \`https://api.example.com/customers?page=${page}\`  
  )  
    
  return await response.json()  
}  
\`\`\`

\#\# 🔒 Headers Importantes  
\`\`\`typescript  
const standardHeaders \= {  
  // Authentication  
  'Authorization': 'Bearer \<token\>',  
    
  // Content negotiation  
  'Accept': 'application/json',  
  'Content-Type': 'application/json',  
    
  // User agent (identificar tu app)  
  'User-Agent': 'PymePilot/1.0',  
    
  // Idempotency (para POST repetidos)  
  'Idempotency-Key': '\<uuid\>',  
    
  // Rate limiting info  
  'X-RateLimit-Limit': '1000',  
  'X-RateLimit-Remaining': '999',  
  'X-RateLimit-Reset': '1640000000',  
    
  // Tracing  
  'X-Request-ID': '\<uuid\>',  
    
  // CORS  
  'Access-Control-Allow-Origin': '\*'  
}  
\`\`\`

\#\# ⚡ Cliente API Genérico  
\`\`\`typescript  
interface RequestConfig {  
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'  
  endpoint: string  
  body?: any  
  headers?: Record\<string, string\>  
  params?: Record\<string, string\>  
  timeout?: number  
}

class APIClient {  
  private baseURL: string  
  private defaultHeaders: Record\<string, string\>  
    
  constructor(baseURL: string, accessToken?: string) {  
    this.baseURL \= baseURL  
    this.defaultHeaders \= {  
      'Accept': 'application/json',  
      'Content-Type': 'application/json',  
      'User-Agent': 'PymePilot/1.0',  
      ...(accessToken && { 'Authorization': \`Bearer ${accessToken}\` })  
    }  
  }  
    
  async request\<T\>(config: RequestConfig): Promise\<T\> {  
    const url \= this.buildURL(config.endpoint, config.params)  
      
    const controller \= new AbortController()  
    const timeout \= setTimeout(  
      () \=\> controller.abort(),  
      config.timeout || 30000 // 30s default  
    )  
      
    try {  
      const response \= await fetch(url, {  
        method: config.method,  
        headers: {  
          ...this.defaultHeaders,  
          ...config.headers  
        },  
        body: config.body ? JSON.stringify(config.body) : undefined,  
        signal: controller.signal  
      })  
        
      clearTimeout(timeout)  
        
      // Handle errors  
      if (\!response.ok) {  
        await this.handleError(response)  
      }  
        
      // Handle empty responses (204 No Content)  
      if (response.status \=== 204\) {  
        return {} as T  
      }  
        
      return await response.json()  
        
    } catch (error) {  
      clearTimeout(timeout)  
        
      if (error.name \=== 'AbortError') {  
        throw new Error('Request timeout')  
      }  
        
      throw error  
    }  
  }  
    
  private buildURL(endpoint: string, params?: Record\<string, string\>): string {  
    const url \= new URL(endpoint, this.baseURL)  
      
    if (params) {  
      Object.entries(params).forEach((\[key, value\]) \=\> {  
        url.searchParams.append(key, value)  
      })  
    }  
      
    return url.toString()  
  }  
    
  private async handleError(response: Response): Promise\<never\> {  
    let errorMessage \= \`HTTP ${response.status}\`  
      
    try {  
      const errorBody \= await response.json()  
      errorMessage \= errorBody.message || errorBody.error || errorMessage  
    } catch {  
      // Response no es JSON  
      errorMessage \= await response.text()  
    }  
      
    const error \= new Error(errorMessage) as any  
    error.status \= response.status  
    error.response \= response  
      
    throw error  
  }  
    
  // Convenience methods  
  async get\<T\>(endpoint: string, params?: Record\<string, string\>): Promise\<T\> {  
    return this.request\<T\>({ method: 'GET', endpoint, params })  
  }  
    
  async post\<T\>(endpoint: string, body: any): Promise\<T\> {  
    return this.request\<T\>({ method: 'POST', endpoint, body })  
  }  
    
  async patch\<T\>(endpoint: string, body: any): Promise\<T\> {  
    return this.request\<T\>({ method: 'PATCH', endpoint, body })  
  }  
    
  async delete\<T\>(endpoint: string): Promise\<T\> {  
    return this.request\<T\>({ method: 'DELETE', endpoint })  
  }  
}  
\`\`\`

\*\*Uso:\*\*  
\`\`\`typescript  
const client \= new APIClient('https://api.example.com', accessToken)

// GET  
const customers \= await client.get\<Customer\[\]\>('/customers', {  
  status: 'active',  
  limit: '50'  
})

// POST  
const newCustomer \= await client.post\<Customer\>('/customers', {  
  name: 'John Doe',  
  email: 'john@example.com'  
})

// PATCH  
const updated \= await client.patch\<Customer\>(\`/customers/${id}\`, {  
  status: 'inactive'  
})

// DELETE  
await client.delete(\`/customers/${id}\`)  
\`\`\`

\#\# 🚨 Error Handling  
\`\`\`typescript  
async function handleAPICall\<T\>(  
  apiCall: () \=\> Promise\<T\>  
): Promise\<T\> {  
  try {  
    return await apiCall()  
  } catch (error: any) {  
    // Client errors (4xx)  
    if (error.status \>= 400 && error.status \< 500\) {  
      if (error.status \=== 401\) {  
        throw new Error('UNAUTHORIZED: Token inválido o expirado')  
      }  
      if (error.status \=== 403\) {  
        throw new Error('FORBIDDEN: Sin permisos')  
      }  
      if (error.status \=== 404\) {  
        throw new Error('NOT\_FOUND: Recurso no existe')  
      }  
      if (error.status \=== 422\) {  
        throw new Error(\`VALIDATION\_ERROR: ${error.message}\`)  
      }  
      if (error.status \=== 429\) {  
        throw new Error('RATE\_LIMIT: Demasiadas requests')  
      }  
    }  
      
    // Server errors (5xx) \- retryable  
    if (error.status \>= 500\) {  
      throw new Error('SERVER\_ERROR: Servicio temporalmente no disponible')  
    }  
      
    // Network errors  
    if (error.message \=== 'Request timeout') {  
      throw new Error('TIMEOUT: Request tardó demasiado')  
    }  
      
    throw error  
  }  
}  
\`\`\`

\#\# 📊 Rate Limiting Client-side  
\`\`\`typescript  
class RateLimiter {  
  private requests: number\[\] \= \[\]  
  private limit: number  
  private window: number // ms  
    
  constructor(limit: number, windowMs: number) {  
    this.limit \= limit  
    this.window \= windowMs  
  }  
    
  async acquire(): Promise\<void\> {  
    const now \= Date.now()  
      
    // Remove requests outside window  
    this.requests \= this.requests.filter(  
      time \=\> now \- time \< this.window  
    )  
      
    // Check if can proceed  
    if (this.requests.length \>= this.limit) {  
      const oldestRequest \= this.requests\[0\]  
      const waitTime \= this.window \- (now \- oldestRequest)  
        
      console.log(\`Rate limit: waiting ${waitTime}ms\`)  
      await new Promise(resolve \=\> setTimeout(resolve, waitTime))  
        
      return this.acquire() // Retry  
    }  
      
    // Record request  
    this.requests.push(now)  
  }  
}

// Uso  
const limiter \= new RateLimiter(100, 60000\) // 100 req/min

async function makeAPICall() {  
  await limiter.acquire()  
  return await client.get('/customers')  
}  
\`\`\`

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No manejar timeouts  
\`\`\`typescript  
// ❌ MAL \- Puede colgar indefinidamente  
const response \= await fetch(url)

// ✅ BIEN \- Con timeout  
const controller \= new AbortController()  
const timeout \= setTimeout(() \=\> controller.abort(), 30000\)

const response \= await fetch(url, { signal: controller.signal })  
clearTimeout(timeout)  
\`\`\`

\#\#\# Error 2: No validar status codes  
\`\`\`typescript  
// ❌ MAL \- Asume siempre success  
const data \= await response.json()

// ✅ BIEN \- Verifica status  
if (\!response.ok) {  
  throw new Error(\`HTTP ${response.status}\`)  
}  
const data \= await response.json()  
\`\`\`

\#\#\# Error 3: Hardcodear URLs  
\`\`\`typescript  
// ❌ MAL  
const url \= 'https://api.production.com/customers'

// ✅ BIEN  
const baseURL \= Deno.env.get('API\_BASE\_URL')  
const url \= \`${baseURL}/customers\`  
\`\`\`

\#\# ✅ Checklist

\- \[ \] Timeout configurado (30s default)  
\- \[ \] Error handling completo (4xx, 5xx, network)  
\- \[ \] Headers apropiados (Accept, Content-Type, User-Agent)  
\- \[ \] Pagination implementada  
\- \[ \] Rate limiting client-side  
\- \[ \] Idempotency keys para POST  
\- \[ \] Request ID para tracing  
\- \[ \] Base URL en variable de entorno

\---  
