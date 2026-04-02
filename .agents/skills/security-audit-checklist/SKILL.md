---
name: security-audit-checklist
description: Checklist completo de auditoria de seguridad pre-deploy
---

\# Skill: Security Audit Checklist

\#\# 🎯 Qué es
Checklist completo y sistemático para auditar código de PymePilot ANTES de cualquier commit o deployment. Es la lista maestra que @security-guardian ejecuta en cada revisión.

\*\*Analogía Simple:\*\*
Es como la lista de verificación que un piloto revisa antes de despegar:
\- ✅ Combustible suficiente
\- ✅ Sistemas de navegación OK
\- ✅ Permisos de torre de control

En código:
\- ✅ Secrets protegidos
\- ✅ Autenticación configurada
\- ✅ Aislamiento multi-tenant funcionando

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE en:
\- ✅ Antes de cada commit a \`main\`
\- ✅ Antes de cada deployment a producción
\- ✅ Después de integrar código de cualquier agente
\- ✅ Antes de abrir PR para review

\#\#\# Usar ESPECIALMENTE cuando:
\- ⚠️ Se modifica código de autenticación/autorización
\- ⚠️ Se agregan nuevas tablas a PostgreSQL
\- ⚠️ Se crean nuevos endpoints de API
\- ⚠️ Se integran servicios third-party (Kommo, WhatsApp)

\#\# ✅ Checklist Completo

\#\#\# SECCIÓN 1: Secrets Management

\#\#\#\# 1.1 Archivos de Configuración
\`\`\`bash
\# Verificar que estos archivos NO están en el repo
\- \[ \] .env NO está commiteado
\- \[ \] .env.local NO está commiteado
\- \[ \] .env.production NO está commiteado
\- \[ \] serviceAccountKey.json NO está commiteado (si usás Firebase)
\- \[ \] \*.pem files NO están commiteados
\- \[ \] \*.key files NO están commiteados
\`\`\`

\#\#\#\# 1.2 Código Fuente
\`\`\`bash
\# Buscar patterns de secrets hardcodeados
\- \[ \] No hay strings que empiecen con "sk\_" (Stripe keys)
\- \[ \] No hay strings que empiecen con "pk\_" (Public keys que deberían estar en .env)
\- \[ \] No hay "PASSWORD \=" en código
\- \[ \] No hay "API\_KEY \=" hardcodeado
\- \[ \] No hay tokens JWT hardcodeados
\- \[ \] No hay connection strings con passwords
\`\`\`

\*\*Ejemplo de lo que NO debe existir:\*\*
\`\`\`python
\# ❌ MAL \- Hardcoded
SUPABASE\_URL \= "https://abc123.supabase.co"
SUPABASE\_KEY \= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

\# ✅ BIEN \- Desde .env
SUPABASE\_URL \= os.getenv("SUPABASE\_URL")
SUPABASE\_KEY \= os.getenv("SUPABASE\_KEY")
if not SUPABASE\_URL or not SUPABASE\_KEY:
    raise ValueError("Missing Supabase credentials")
\`\`\`

\#\#\#\# 1.3 .gitignore Completo
\`\`\`bash
\# Verificar que .gitignore incluye TODO esto:
\- \[ \] .env\*
\- \[ \] \*.log
\- \[ \] \*.pem
\- \[ \] \*.key
\- \[ \] \_\_pycache\_\_/
\- \[ \] node\_modules/
\- \[ \] .next/
\- \[ \] .vercel/
\- \[ \] .DS\_Store
\- \[ \] venv/
\- \[ \] \*.sqlite
\- \[ \] \*.db
\`\`\`

\---

\#\#\# SECCIÓN 2: Multi-Tenant Security

\#\#\#\# 2.1 Base de Datos (PostgreSQL)
\`\`\`sql
\-- Verificar que TODAS las tablas tienen tenant\_id
\- \[ \] Tabla \`customers\` tiene columna \`tenant\_id\`
\- \[ \] Tabla \`products\` tiene columna \`tenant\_id\`
\- \[ \] Tabla \`predictions\` tiene columna \`tenant\_id\`
\- \[ \] Tabla \`whatsapp\_messages\` tiene columna \`tenant\_id\`

\-- Verificar que TODAS las tablas tienen RLS
\- \[ \] \`customers\` tiene RLS policy
\- \[ \] \`products\` tiene RLS policy
\- \[ \] \`predictions\` tiene RLS policy
\- \[ \] \`whatsapp\_messages\` tiene RLS policy

\-- Verificar que RLS está ENABLED
\- \[ \] \`ALTER TABLE customers ENABLE ROW LEVEL SECURITY;\` ejecutado
\- \[ \] \`ALTER TABLE products ENABLE ROW LEVEL SECURITY;\` ejecutado
\`\`\`

\*\*Ejemplo de RLS Policy correcta:\*\*
\`\`\`sql
\-- ✅ BIEN \- Policy que verifica tenant\_id
CREATE POLICY "tenant\_isolation\_policy" ON customers
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Test de la policy
SET app.tenant\_id \= 'uuid-de-iey';
SELECT \* FROM customers; \-- Solo ve clientes de IEY

SET app.tenant\_id \= 'uuid-de-otro-tenant';
SELECT \* FROM customers; \-- No ve nada de IEY
\`\`\`

\#\#\#\# 2.2 Código de Backend (Python/Edge Functions)
\`\`\`python
\# Verificar que TODAS las queries incluyen tenant\_id
\- \[ \] Queries de lectura filtran por tenant\_id
\- \[ \] Queries de escritura incluyen tenant\_id
\- \[ \] No hay queries tipo \`SELECT \* FROM customers\` sin WHERE
\- \[ \] No hay \`DELETE FROM\` sin WHERE tenant\_id

\# Ejemplo de query CORRECTA
\# ✅ BIEN
def get\_customers(tenant\_id: str):
    query \= """
        SELECT \* FROM customers
        WHERE tenant\_id \= %s
        AND status \= 'active'
    """
    return db.execute(query, (tenant\_id,))

\# ❌ MAL \- Falta tenant\_id
def get\_customers():
    query \= "SELECT \* FROM customers WHERE status \= 'active'"
    return db.execute(query)
\`\`\`

\#\#\#\# 2.3 Frontend (Next.js)
\`\`\`typescript
// Verificar que el frontend NUNCA confía en tenant\_id del cliente
\- \[ \] tenant\_id viene SIEMPRE del token JWT
\- \[ \] No hay \`const tenantId \= searchParams.get('tenant')\` sin validar
\- \[ \] Server Actions validan tenant contra sesión
\- \[ \] API routes validan tenant contra auth token

// ✅ BIEN \- Tenant desde sesión
export async function getPredictions() {
  const supabase \= createClient()
  const { data: { user } } \= await supabase.auth.getUser()

  if (\!user) throw new Error('Unauthorized')

  // tenant\_id viene del JWT, NO del request
  const tenantId \= user.user\_metadata.tenant\_id

  const { data } \= await supabase
    .from('predictions')
    .select('\*')
    .eq('tenant\_id', tenantId)

  return data
}

// ❌ MAL \- Confía en el cliente
export async function getPredictions(tenantId: string) {
  // Cualquiera puede pasar el tenantId que quiera
  const { data } \= await supabase
    .from('predictions')
    .select('\*')
    .eq('tenant\_id', tenantId)

  return data
}
\`\`\`

\---

\#\#\# SECCIÓN 3: API Security

\#\#\#\# 3.1 Autenticación
\`\`\`bash
\# Verificar endpoints públicos vs privados
\- \[ \] /api/health es público (OK)
\- \[ \] /api/predictions requiere auth ✅
\- \[ \] /api/customers requiere auth ✅
\- \[ \] /api/admin/\* requiere auth \+ role check ✅

\# Verificar Supabase Auth configurado
\- \[ \] JWT\_SECRET configurado en .env
\- \[ \] JWT\_EXPIRY configurado (ej: 3600 \= 1 hora)
\- \[ \] Refresh tokens habilitados
\`\`\`

\*\*Ejemplo de endpoint protegido:\*\*
\`\`\`typescript
// ✅ BIEN \- Endpoint protegido
export async function GET(request: Request) {
  const supabase \= createClient()
  const { data: { user }, error } \= await supabase.auth.getUser()

  if (error || \!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Continuar con lógica...
}

// ❌ MAL \- Sin autenticación
export async function GET(request: Request) {
  // Cualquiera puede llamar esto
  const { data } \= await supabase.from('predictions').select('\*')
  return Response.json(data)
}
\`\`\`

\#\#\#\# 3.2 Rate Limiting
\`\`\`bash
\# Verificar límites configurados
\- \[ \] Traefik tiene rate limit (100 req/min por IP)
\- \[ \] Edge Functions tienen rate limit
\- \[ \] Endpoints críticos (login, signup) tienen límite MÁS estricto (10 req/min)

\# Verificar en Traefik config
\- \[ \] middlewares.rate-limit definido en docker-compose.yml
\- \[ \] Labels en servicios incluyen rate-limit middleware
\`\`\`

\*\*Ejemplo de Traefik rate limiting:\*\*
\`\`\`yaml
\# docker-compose.yml
services:
  traefik:
    command:
      \- "--providers.docker=true"
      \- "--entrypoints.web.address=:80"
      \- "--entrypoints.websecure.address=:443"
    labels:
      \# Rate limit: 100 requests por minuto
      \- "traefik.http.middlewares.rate-limit.ratelimit.average=100"
      \- "traefik.http.middlewares.rate-limit.ratelimit.period=1m"
\`\`\`

\#\#\#\# 3.3 CORS
\`\`\`bash
\# Verificar CORS configurado correctamente
\- \[ \] Dominios permitidos son SOLO los necesarios
\- \[ \] No hay \`Access-Control-Allow-Origin: \*\` en producción
\- \[ \] Métodos permitidos son solo los usados (GET, POST, no DELETE en frontend)
\`\`\`

\*\*Ejemplo de CORS correcto:\*\*
\`\`\`typescript
// ✅ BIEN \- CORS específico
const allowedOrigins \= \[
  'https://pymepilot.cloud',
  'https://dashboard.pymepilot.cloud',
  process.env.NODE\_ENV \=== 'development' ? 'http://localhost:3000' : null
\].filter(Boolean)

// ❌ MAL \- CORS abierto
const corsHeaders \= {
  'Access-Control-Allow-Origin': '\*', // ❌ Cualquier sitio puede llamar
}
\`\`\`

\#\#\#\# 3.4 Input Validation
\`\`\`bash
\# Verificar validación de inputs
\- \[ \] Todos los endpoints validan inputs con Zod o similar
\- \[ \] No hay \`eval()\` de strings del usuario
\- \[ \] No hay ejecución de SQL dinámico sin parametrizar
\- \[ \] Validación de tipos (email es email, phone es phone, etc.)
\`\`\`

\*\*Ejemplo con Zod:\*\*
\`\`\`typescript
import { z } from 'zod'

// ✅ BIEN \- Schema de validación
const PredictionRequestSchema \= z.object({
  customer\_id: z.string().uuid(),
  vertical: z.enum(\['activacion', 'reposicion', 'cross\_sell', 'recuperacion'\]),
  config: z.object({
    temperature: z.number().min(0).max(1).optional()
  }).optional()
})

export async function POST(request: Request) {
  const body \= await request.json()

  // Validar antes de usar
  const validated \= PredictionRequestSchema.safeParse(body)

  if (\!validated.success) {
    return Response.json(
      { error: validated.error.issues },
      { status: 400 }
    )
  }

  // Ahora sí, usar validated.data
  const { customer\_id, vertical } \= validated.data
  // ...
}
\`\`\`

\---

\#\#\# SECCIÓN 4: Permisos de Archivos
\`\`\`bash
\# Verificar permisos en servidor
\- \[ \] .env tiene permisos 600 (solo owner puede leer/escribir)
\- \[ \] Scripts .sh tienen permisos 700 (solo owner puede ejecutar)
\- \[ \] Archivos de código tienen 644 (owner escribe, todos leen)
\- \[ \] Directorios tienen 755
\- \[ \] NO HAY archivos con 777 (todos pueden todo \- PELIGROSO)

\# Comando para verificar
find /home/pato/pymepilot-core \-type f \-perm 0777
\# Debe retornar vacío (0 archivos)
\`\`\`

\*\*Script de fix de permisos:\*\*
\`\`\`bash
\#\!/bin/bash
\# fix-permissions.sh

\# .env files → 600
find /home/pato/pymepilot-core \-name ".env\*" \-exec chmod 600 {} \\;

\# Scripts → 700
find /home/pato/pymepilot-core \-name "\*.sh" \-exec chmod 700 {} \\;

\# Código → 644
find /home/pato/pymepilot-core \-name "\*.py" \-exec chmod 644 {} \\;
find /home/pato/pymepilot-core \-name "\*.ts" \-exec chmod 644 {} \\;
find /home/pato/pymepilot-core \-name "\*.tsx" \-exec chmod 644 {} \\;

\# Directorios → 755
find /home/pato/pymepilot-core \-type d \-exec chmod 755 {} \\;
\`\`\`

\---

\#\#\# SECCIÓN 5: Dependencies
\`\`\`bash
\# Verificar dependencias
\- \[ \] package.json tiene dependencias EXACTAS (no ^version)
\- \[ \] requirements.txt tiene versiones PINNED (package==1.2.3)
\- \[ \] No hay dependencias con vulnerabilidades conocidas

\# Escanear vulnerabilidades
npm audit \--audit-level=high
pip-audit

\# Si hay vulnerabilidades → RECHAZAR hasta fix
\`\`\`

\---

\#\#\# SECCIÓN 6: Logging & Monitoring
\`\`\`bash
\# Verificar que NO se loggea info sensible
\- \[ \] Logs NO incluyen passwords
\- \[ \] Logs NO incluyen tokens completos (solo últimos 4 chars)
\- \[ \] Logs NO incluyen datos de clientes (nombres, emails, teléfonos)
\- \[ \] Logs incluyen tenant\_id (para debugging multi-tenant)
\`\`\`

\*\*Ejemplo de logging correcto:\*\*
\`\`\`python
import logging

\# ❌ MAL \- Loggea password
logger.info(f"User login: {email} with password {password}")

\# ✅ BIEN \- Solo info no sensible
logger.info(f"Login attempt for tenant {tenant\_id}")

\# ✅ BIEN \- Token truncado
logger.info(f"API call with token ...{token\[-4:\]}")
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: "Es solo para testing"
\`\`\`python
\# ❌ NUNCA hagas esto
if os.getenv('ENV') \== 'development':
    \# Deshabilitar seguridad "temporalmente"
    REQUIRE\_AUTH \= False
\`\`\`

\*\*Por qué es peligroso:\*\*
\- Alguien va a olvidar borrarlo
\- Puede llegar a producción por error
\- Testing debe ser con seguridad REAL, datos FALSOS

\*\*Fix:\*\*
\`\`\`python
\# ✅ Siempre requerir auth
REQUIRE\_AUTH \= True

\# Testing con datos de prueba
if os.getenv('ENV') \== 'development':
    DEFAULT\_TENANT\_ID \= 'test-tenant-uuid'
\`\`\`

\#\#\# Error 2: Confiar en el cliente
\`\`\`typescript
// ❌ MAL
async function deleteCustomer(customerId: string, tenantId: string) {
  // El frontend puede mandar cualquier tenantId
  await supabase.from('customers')
    .delete()
    .eq('id', customerId)
    .eq('tenant\_id', tenantId)
}

// ✅ BIEN
async function deleteCustomer(customerId: string) {
  const { user } \= await supabase.auth.getUser()
  const tenantId \= user.user\_metadata.tenant\_id // Del JWT

  await supabase.from('customers')
    .delete()
    .eq('id', customerId)
    .eq('tenant\_id', tenantId)
}
\`\`\`

\#\#\# Error 3: SQL Injection via string concatenation
\`\`\`python
\# ❌ MAL \- Vulnerable a SQL injection
customer\_id \= request.get('customer\_id')
query \= f"SELECT \* FROM customers WHERE id \= '{customer\_id}'"
db.execute(query)

\# Ataque posible:
\# customer\_id \= "1' OR '1'='1"
\# → Retorna TODOS los clientes

\# ✅ BIEN \- Parametrized query
customer\_id \= request.get('customer\_id')
query \= "SELECT \* FROM customers WHERE id \= %s"
db.execute(query, (customer\_id,))
\`\`\`

\---

\#\# ✅ Checklist de Validación

Antes de aprobar código, verificar:

\#\#\# Pre-Commit
\- \[ \] Ejecuté \`detect-secrets scan\` → 0 secrets encontrados
\- \[ \] Ejecuté \`npm audit\` / \`pip-audit\` → 0 vulnerabilidades HIGH/CRITICAL
\- \[ \] Verifiqué permisos con \`find . \-perm 0777\` → 0 archivos
\- \[ \] Verifiqué .gitignore incluye .env\*

\#\#\# Multi-Tenant
\- \[ \] Todas las tablas nuevas tienen \`tenant\_id\`
\- \[ \] Todas las tablas tienen RLS policy
\- \[ \] Testeé aislamiento (tenant A no ve datos de tenant B)
\- \[ \] Queries backend incluyen \`WHERE tenant\_id \= %s\`

\#\#\# API Security
\- \[ \] Endpoints protegidos con auth (excepto /health)
\- \[ \] Rate limiting configurado
\- \[ \] CORS solo permite dominios necesarios
\- \[ \] Inputs validados con Zod/Pydantic

\#\#\# Testing
\- \[ \] Tests de SQL injection escritos
\- \[ \] Tests de RLS bypass escritos
\- \[ \] Tests de XSS en inputs escritos
\- \[ \] CI/CD ejecuta security tests

\---

\#\# 📊 Métricas de Éxito

Un audit PASA si:
\- ✅ 0 secrets hardcodeados
\- ✅ 0 vulnerabilidades HIGH/CRITICAL
\- ✅ 100% de tablas con RLS
\- ✅ 100% de endpoints autenticados (excepto públicos)
\- ✅ 0 archivos con permisos 777
\- ✅ 100% de tests de seguridad pasando

\---

\#\# 🔗 Referencias

\#\#\# Tools Recomendados
\- \[detect-secrets\](https://github.com/Yelp/detect-secrets) \- Escaneo de secrets
\- \[semgrep\](https://semgrep.dev/) \- SAST (Static Analysis)
\- \[npm audit\](https://docs.npmjs.com/cli/v8/commands/npm-audit) \- Vulnerabilidades JS
\- \[pip-audit\](https://github.com/pypa/pip-audit) \- Vulnerabilidades Python
\- \[OWASP ZAP\](https://www.zaproxy.org/) \- Penetration testing

\#\#\# Documentación
\- \[OWASP Top 10\](https://owasp.org/www-project-top-ten/)
\- \[Supabase Security Best Practices\](https://supabase.com/docs/guides/platform/security)
\- \[PostgreSQL RLS\](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

\---

\#\# 💡 Para Pato (Uso Práctico)

\#\#\# Integración con Codex

\*\*Paso 1:\*\* Antes de cada sesión
\`\`\`bash
\~/scripts/codex-safe.sh
\`\`\`

\*\*Paso 2:\*\* Después de generar código con otro agente
\`\`\`
@security-guardian ejecutá security-audit-checklist sobre:
\- Archivos: \[lista de archivos generados\]
\- Foco en: \[multi-tenant / API security / secrets\]
\`\`\`

\*\*Paso 3:\*\* Antes de commit
\`\`\`
@security-guardian audit completo pre-commit
\`\`\`

\#\#\# Tu primer audit (recomendado)

Una vez que tengas este skill:
\`\`\`bash
\# Crear el archivo
mkdir \-p /home/pato/pymepilot-core/.agents/skills/security
nano /home/pato/pymepilot-core/.agents/skills/security/security-audit-checklist.md

\# Pegar el contenido de arriba

\# Testear con Codex
cd /home/pato/pymepilot-core
claude

\# En Codex:
@security-guardian usando /skills/security/security-audit-checklist.md
auditá el proyecto actual de IEY
\`\`\`

Esto va a revelar problemas existentes que podés ir arreglando de a poco.

\---
