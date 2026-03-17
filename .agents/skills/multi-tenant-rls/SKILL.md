\# Skill: Multi-Tenant RLS (Row Level Security)

\#\# 🎯 Qué es  
Sistema completo de Row Level Security (RLS) para arquitectura multi-tenant en PymePilot. Garantiza aislamiento total entre tenants a nivel de base de datos, de forma que cada tenant SOLO puede ver/modificar sus propios datos.

\*\*Analogía Simple:\*\*  
RLS es como tener un edificio con departamentos donde cada inquilino:  
\- Tiene su propia llave (tenant\_id)  
\- Cuando abre la puerta, SOLO ve su departamento  
\- No puede entrar a departamentos de otros  
\- No puede ni siquiera VER lo que hay en otros departamentos

En PostgreSQL:  
\- Cada query automáticamente filtra por tenant\_id  
\- No importa qué query ejecutes, RLS lo filtra  
\- Protección a nivel DB (no depende de código de app)  
\- Si RLS falla → desastre (tenant A ve datos de tenant B)

\*\*Por qué es CRÍTICO para PymePilot:\*\*  
\- IEY no puede ver datos de otros distribuidores  
\- Protección incluso si hay bug en código de app  
\- Compliance legal (privacidad de datos)  
\- Confianza de clientes

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear CADA tabla nueva con tenant\_id  
\- ✅ Al modificar estructura de tabla con RLS  
\- ✅ Antes de CADA deployment a producción  
\- ✅ Después de cambios en lógica de autenticación

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Agregás columnas a tabla con RLS  
\- ⚠️ Modificás políticas de acceso  
\- ⚠️ Detectás queries lentas (RLS puede afectar)  
\- ⚠️ Onboardeás nuevo tenant

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Anatomía Completa de RLS

\*\*Los 3 componentes obligatorios:\*\*  
\`\`\`sql  
\-- PASO 1: Habilitar RLS en la tabla  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

\-- Sin esto, RLS NO funciona (tabla abierta a todos)  
\-- Verificar que está habilitado:  
SELECT tablename, rowsecurity   
FROM pg\_tables   
WHERE schemaname \= 'public' AND tablename \= 'customers';  
\-- Debe retornar: rowsecurity \= true

\-- PASO 2: Crear policies (una por operación)  
\-- Policy para SELECT (lectura)  
CREATE POLICY "customers\_select\_policy" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para INSERT (creación)  
CREATE POLICY "customers\_insert\_policy" ON customers  
    FOR INSERT  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para UPDATE (modificación)  
CREATE POLICY "customers\_update\_policy" ON customers  
    FOR UPDATE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para DELETE (eliminación)  
CREATE POLICY "customers\_delete\_policy" ON customers  
    FOR DELETE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- PASO 3: Setear tenant\_id en cada sesión de DB  
\-- En Python:  
conn.execute("SET app.tenant\_id \= %s", (tenant\_id,))

\-- En Supabase Edge Function:  
await supabase.rpc('set\_tenant\_context', { tenant\_id: tenantId })

\-- Ahora TODAS las queries respetan RLS automáticamente  
\`\`\`

\*\*Desglose de cada parte:\*\*  
\`\`\`sql  
\-- USING clause  
USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)

\-- Qué significa:  
\-- \- current\_setting('app.tenant\_id'): Lee variable de sesión  
\-- \- ::uuid: Convierte TEXT a UUID  
\-- \- tenant\_id \= ...: Compara con columna de la tabla  
\-- \- Si la comparación es TRUE → row visible  
\-- \- Si es FALSE → row invisible (como si no existiera)

\-- WITH CHECK clause  
WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid)

\-- Qué significa:  
\-- \- Valida datos al INSERTAR o ACTUALIZAR  
\-- \- Si check pasa → operación permitida  
\-- \- Si check falla → ERROR (operación bloqueada)  
\-- \- Previene que user de tenant A cree data en tenant B  
\`\`\`

\#\#\# Práctica 2: Policies para Todos los Casos

\*\*Template completo para tabla multi-tenant:\*\*  
\`\`\`sql  
\-- 1\. Habilitar RLS  
ALTER TABLE tabla\_nombre ENABLE ROW LEVEL SECURITY;

\-- 2\. Policy ALL (simplificada \- para desarrollo rápido)  
CREATE POLICY "tenant\_isolation\_all" ON tabla\_nombre  
    FOR ALL  \-- Aplica a SELECT, INSERT, UPDATE, DELETE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- O

\-- 3\. Policies granulares (producción \- más control)  
CREATE POLICY "tenant\_select" ON tabla\_nombre  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_insert" ON tabla\_nombre  
    FOR INSERT  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_update" ON tabla\_nombre  
    FOR UPDATE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_delete" ON tabla\_nombre  
    FOR DELETE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\*\*Cuándo usar cada approach:\*\*  
\`\`\`sql  
\-- Policy ALL (simplificada)  
\-- ✅ Usar cuando:  
\--    \- Reglas son idénticas para todas las operaciones  
\--    \- Desarrollo rápido (MVP)  
\--    \- Tabla simple sin lógica especial

\-- Policies granulares  
\-- ✅ Usar cuando:  
\--    \- Diferentes reglas por operación  
\--    \- Solo admins pueden DELETE  
\--    \- Solo owners pueden UPDATE  
\--    \- Producción (más auditable)  
\`\`\`

\#\#\# Práctica 3: RLS con Roles y Permisos

\*\*Caso: Solo admins pueden eliminar customers\*\*  
\`\`\`sql  
\-- Policy para SELECT/INSERT/UPDATE (todos los users)  
CREATE POLICY "tenant\_read\_write" ON customers  
    FOR SELECT, INSERT, UPDATE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para DELETE (solo admins)  
CREATE POLICY "tenant\_delete\_admin\_only" ON customers  
    FOR DELETE  
    USING (  
        tenant\_id \= current\_setting('app.tenant\_id')::uuid  
        AND current\_setting('app.user\_role')::text \= 'admin'  
    );

\-- Setear role en sesión:  
conn.execute("SET app.user\_role \= %s", (user\_role,))  
\`\`\`

\*\*Caso: Users solo ven sus propios datos \+ datos públicos\*\*  
\`\`\`sql  
\-- Agregar columna owner\_id  
ALTER TABLE documents ADD COLUMN owner\_id UUID REFERENCES users(id);  
ALTER TABLE documents ADD COLUMN is\_public BOOLEAN DEFAULT false;

\-- Policy: Ver documentos propios O públicos del tenant  
CREATE POLICY "documents\_select" ON documents  
    FOR SELECT  
    USING (  
        tenant\_id \= current\_setting('app.tenant\_id')::uuid  
        AND (  
            owner\_id \= current\_setting('app.user\_id')::uuid  
            OR is\_public \= true  
        )  
    );

\-- Policy: Solo modificar documentos propios  
CREATE POLICY "documents\_update" ON documents  
    FOR UPDATE  
    USING (  
        tenant\_id \= current\_setting('app.tenant\_id')::uuid  
        AND owner\_id \= current\_setting('app.user\_id')::uuid  
    )  
    WITH CHECK (  
        tenant\_id \= current\_setting('app.tenant\_id')::uuid  
        AND owner\_id \= current\_setting('app.user\_id')::uuid  
    );  
\`\`\`

\#\#\# Práctica 4: Función Helper para Setear Tenant

\*\*SQL Function para setear tenant context:\*\*  
\`\`\`sql  
\-- Función segura para setear tenant\_id  
CREATE OR REPLACE FUNCTION set\_tenant\_context(p\_tenant\_id UUID)  
RETURNS void  
LANGUAGE plpgsql  
SECURITY DEFINER  \-- Ejecuta con permisos del owner  
SET search\_path \= public, pg\_temp  
AS $$  
BEGIN  
    \-- Validar que tenant existe  
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id \= p\_tenant\_id) THEN  
        RAISE EXCEPTION 'Invalid tenant\_id: %', p\_tenant\_id;  
    END IF;  
      
    \-- Setear variable de sesión  
    PERFORM set\_config('app.tenant\_id', p\_tenant\_id::text, false);  
      
    \-- Log para auditoría (opcional)  
    INSERT INTO tenant\_access\_logs (tenant\_id, accessed\_at)  
    VALUES (p\_tenant\_id, NOW());  
END;  
$$;

\-- Uso desde Python:  
conn.execute("SELECT set\_tenant\_context(%s)", (tenant\_id,))

\-- Uso desde Supabase Edge Function:  
await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
\`\`\`

\*\*Función para obtener tenant actual:\*\*  
\`\`\`sql  
\-- Helper para obtener tenant\_id de sesión actual  
CREATE OR REPLACE FUNCTION get\_current\_tenant\_id()  
RETURNS UUID  
LANGUAGE plpgsql  
STABLE  
AS $$  
BEGIN  
    RETURN current\_setting('app.tenant\_id')::uuid;  
EXCEPTION  
    WHEN OTHERS THEN  
        RETURN NULL;  
END;  
$$;

\-- Uso en queries:  
SELECT \* FROM customers WHERE tenant\_id \= get\_current\_tenant\_id();

\-- Uso en defaults:  
ALTER TABLE customers   
    ALTER COLUMN tenant\_id SET DEFAULT get\_current\_tenant\_id();  
\`\`\`

\#\#\# Práctica 5: Testing de RLS

\*\*Script SQL de testing manual:\*\*  
\`\`\`sql  
\-- Testing manual de RLS

\-- Setup: Crear 2 tenants de prueba  
INSERT INTO tenants (id, name, email) VALUES  
    ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'a@test.com'),  
    ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'b@test.com');

\-- Crear customers para cada tenant  
INSERT INTO customers (tenant\_id, name, email) VALUES  
    ('11111111-1111-1111-1111-111111111111', 'Customer A1', 'a1@test.com'),  
    ('11111111-1111-1111-1111-111111111111', 'Customer A2', 'a2@test.com'),  
    ('22222222-2222-2222-2222-222222222222', 'Customer B1', 'b1@test.com'),  
    ('22222222-2222-2222-2222-222222222222', 'Customer B2', 'b2@test.com');

\-- TEST 1: Tenant A solo ve sus customers  
SET app.tenant\_id \= '11111111-1111-1111-1111-111111111111';  
SELECT COUNT(\*) FROM customers;  
\-- Debe retornar: 2

SELECT name FROM customers ORDER BY name;  
\-- Debe retornar: Customer A1, Customer A2

\-- TEST 2: Tenant B solo ve sus customers  
SET app.tenant\_id \= '22222222-2222-2222-2222-222222222222';  
SELECT COUNT(\*) FROM customers;  
\-- Debe retornar: 2

SELECT name FROM customers ORDER BY name;  
\-- Debe retornar: Customer B1, Customer B2

\-- TEST 3: Sin tenant\_id seteado → 0 results o ERROR  
RESET app.tenant\_id;  
SELECT COUNT(\*) FROM customers;  
\-- Debe retornar: 0 o ERROR (dependiendo de config)

\-- TEST 4: Intentar insertar en otro tenant (debe fallar)  
SET app.tenant\_id \= '11111111-1111-1111-1111-111111111111';

INSERT INTO customers (tenant\_id, name, email) VALUES  
    ('22222222-2222-2222-2222-222222222222', 'Hacker', 'hack@evil.com');  
\-- Debe fallar con: ERROR: new row violates row-level security policy

\-- TEST 5: Intentar actualizar tenant\_id (debe fallar)  
UPDATE customers   
SET tenant\_id \= '22222222-2222-2222-2222-222222222222'  
WHERE name \= 'Customer A1';  
\-- Debe fallar con: ERROR: new row violates row-level security policy

\-- Cleanup  
DELETE FROM customers WHERE email LIKE '%@test.com';  
DELETE FROM tenants WHERE email LIKE '%@test.com';  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: RLS en Tabla Customers (Completo)  
\`\`\`sql  
\-- 1\. Crear tabla  
CREATE TABLE customers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    name TEXT NOT NULL,  
    email TEXT NOT NULL,  
    phone TEXT,  
    status TEXT DEFAULT 'active',  
    created\_at TIMESTAMPTZ DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ DEFAULT NOW(),  
      
    CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email)  
);

\-- 2\. Indexes  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);

\-- 3\. Habilitar RLS  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

\-- 4\. Crear policies  
CREATE POLICY "customers\_tenant\_isolation" ON customers  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- 5\. Verificar que funciona  
\-- Como Tenant IEY  
SET app.tenant\_id \= 'uuid-de-iey';  
SELECT \* FROM customers;  \-- Solo ve customers de IEY

\-- Como Tenant DEMO  
SET app.tenant\_id \= 'uuid-de-demo';  
SELECT \* FROM customers;  \-- Solo ve customers de DEMO  
\`\`\`

\#\#\# Ejemplo 2: RLS en Python Backend  
\`\`\`python  
import psycopg  
import os  
from uuid import UUID  
from contextlib import contextmanager

class TenantDB:  
    """Wrapper de DB con tenant context automático"""  
      
    def \_\_init\_\_(self, database\_url: str):  
        self.database\_url \= database\_url  
      
    @contextmanager  
    def get\_connection(self, tenant\_id: UUID):  
        """  
        Context manager que setea tenant\_id automáticamente  
          
        Uso:  
            with db.get\_connection(tenant\_id) as conn:  
                customers \= conn.execute("SELECT \* FROM customers").fetchall()  
        """  
        conn \= psycopg.connect(self.database\_url)  
          
        try:  
            \# Setear tenant\_id ANTES de cualquier query  
            conn.execute(  
                "SELECT set\_tenant\_context(%s)",  
                (str(tenant\_id),)  
            )  
              
            yield conn  
              
            conn.commit()  
              
        except Exception as e:  
            conn.rollback()  
            raise e  
          
        finally:  
            conn.close()

\# Inicializar  
db \= TenantDB(os.getenv('DATABASE\_URL'))

\# Uso en vertical de Activación  
def get\_inactive\_customers(tenant\_id: UUID, days\_inactive: int \= 90):  
    """Obtener clientes inactivos para activar"""  
      
    with db.get\_connection(tenant\_id) as conn:  
        \# RLS filtra automáticamente por tenant\_id  
        \# No necesitamos agregar WHERE tenant\_id \= ...  
        result \= conn.execute("""  
            SELECT   
                id,  
                name,  
                email,  
                phone,  
                last\_purchase\_date  
            FROM customers  
            WHERE status \= 'active'  
            AND last\_purchase\_date \< NOW() \- INTERVAL '%s days'  
            ORDER BY last\_purchase\_date DESC  
            LIMIT 50  
        """, (days\_inactive,)).fetchall()  
          
        return result

\# Uso  
tenant\_iey\_id \= UUID('123e4567-e89b-12d3-a456-426614174000')  
customers \= get\_inactive\_customers(tenant\_iey\_id, days\_inactive=90)  
\# Solo retorna customers de IEY, aunque no filtramos explícitamente  
\`\`\`

\#\#\# Ejemplo 3: RLS en Supabase Edge Function  
\`\`\`typescript  
// Edge Function: get-predictions.ts  
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) \=\> {  
  // 1\. Crear cliente de Supabase  
  const supabase \= createClient(  
    Deno.env.get('SUPABASE\_URL')\!,  
    Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
  )  
    
  // 2\. Autenticar usuario  
  const authHeader \= req.headers.get('Authorization')\!  
  const token \= authHeader.replace('Bearer ', '')  
    
  const { data: { user }, error: authError } \=   
    await supabase.auth.getUser(token)  
    
  if (authError || \!user) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  // 3\. Obtener tenant\_id del JWT  
  const tenantId \= user.user\_metadata.tenant\_id  
    
  if (\!tenantId) {  
    return new Response('Missing tenant\_id in JWT', { status: 400 })  
  }  
    
  // 4\. CRÍTICO: Setear tenant context  
  const { error: contextError } \= await supabase.rpc(  
    'set\_tenant\_context',  
    { p\_tenant\_id: tenantId }  
  )  
    
  if (contextError) {  
    console.error('Failed to set tenant context:', contextError)  
    return new Response('Internal error', { status: 500 })  
  }  
    
  // 5\. Ahora RLS filtra automáticamente  
  const { data: predictions, error } \= await supabase  
    .from('predictions')  
    .select(\`  
      id,  
      vertical,  
      message\_text,  
      confidence\_score,  
      status,  
      created\_at,  
      customer:customers(name, email)  
    \`)  
    .order('created\_at', { ascending: false })  
    .limit(100)  
    
  if (error) {  
    console.error('Query error:', error)  
    return new Response('Internal error', { status: 500 })  
  }  
    
  // Solo contiene predictions del tenant del usuario  
  return new Response(  
    JSON.stringify(predictions),  
    { headers: { 'Content-Type': 'application/json' } }  
  )  
})  
\`\`\`

\#\#\# Ejemplo 4: RLS con Service Role Key (CUIDADO)  
\`\`\`typescript  
// IMPORTANTE: Service Role Key BYPASEA RLS por defecto  
// Siempre setear tenant context explícitamente

// ❌ MAL \- Bypasea RLS  
const supabase \= createClient(  
  SUPABASE\_URL,  
  SUPABASE\_SERVICE\_ROLE\_KEY  
)

const { data } \= await supabase  
  .from('customers')  
  .select('\*')  
// Retorna TODOS los customers de TODOS los tenants (PELIGROSO)

// ✅ BIEN \- Setear tenant primero  
const supabase \= createClient(  
  SUPABASE\_URL,  
  SUPABASE\_SERVICE\_ROLE\_KEY  
)

// Setear tenant context  
await supabase.rpc('set\_tenant\_context', {   
  p\_tenant\_id: user.user\_metadata.tenant\_id   
})

const { data } \= await supabase  
  .from('customers')  
  .select('\*')  
// Ahora RLS funciona correctamente  
\`\`\`

\#\#\# Ejemplo 5: RLS en JOINs Multi-Tabla  
\`\`\`sql  
\-- RLS funciona en JOINs automáticamente  
\-- Si ambas tablas tienen RLS, ambas filtran por tenant

\-- Setup  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;  
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers\_isolation" ON customers  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "orders\_isolation" ON orders  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Query con JOIN  
SET app.tenant\_id \= 'uuid-de-iey';

SELECT   
    c.name as customer\_name,  
    COUNT(o.id) as order\_count,  
    SUM(o.total) as total\_spent  
FROM customers c  
LEFT JOIN orders o ON c.id \= o.customer\_id  
GROUP BY c.id, c.name  
ORDER BY total\_spent DESC  
LIMIT 20;

\-- RLS filtra AMBAS tablas:  
\-- \- customers: solo de IEY  
\-- \- orders: solo de IEY  
\-- Resultado: TOP 20 customers de IEY por gasto  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: Olvidar habilitar RLS  
\`\`\`sql  
\-- ❌ MAL  
CREATE TABLE customers (...);

CREATE POLICY "tenant\_isolation" ON customers  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Problema: Policy existe pero NO se aplica (RLS deshabilitado)

\-- ✅ BIEN  
CREATE TABLE customers (...);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant\_isolation" ON customers  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\#\#\# Error 2: No setear tenant\_id en sesión  
\`\`\`python  
\# ❌ MAL  
conn \= psycopg.connect(DATABASE\_URL)  
\# Sin SET app.tenant\_id  
result \= conn.execute("SELECT \* FROM customers").fetchall()  
\# RLS intenta leer current\_setting('app.tenant\_id') → ERROR o vacío

\# ✅ BIEN  
conn \= psycopg.connect(DATABASE\_URL)  
conn.execute("SET app.tenant\_id \= %s", (tenant\_id,))  
result \= conn.execute("SELECT \* FROM customers").fetchall()  
\`\`\`

\#\#\# Error 3: Policy solo para SELECT  
\`\`\`sql  
\-- ❌ MAL  
CREATE POLICY "tenant\_select" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Problema: INSERT, UPDATE, DELETE quedan BLOQUEADOS

\-- ✅ BIEN \- Policy para TODAS las operaciones  
CREATE POLICY "tenant\_isolation" ON customers  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\#\#\# Error 4: Usar Service Role sin setear tenant  
\`\`\`typescript  
// ❌ MAL  
const supabase \= createClient(URL, SERVICE\_ROLE\_KEY)  
const { data } \= await supabase.from('customers').select('\*')  
// Bypasea RLS → retorna TODOS los tenants

// ✅ BIEN  
const supabase \= createClient(URL, SERVICE\_ROLE\_KEY)  
await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
const { data } \= await supabase.from('customers').select('\*')  
\`\`\`

\#\#\# Error 5: Confiar en frontend para tenant\_id  
\`\`\`typescript  
// ❌ MAL \- Frontend controla tenant  
async function getCustomers(tenantId: string) {  
  // Usuario puede mandar cualquier tenantId  
  const { data } \= await supabase  
    .from('customers')  
    .select('\*')  
    .eq('tenant\_id', tenantId)  
    
  return data  
}

// ✅ BIEN \- Tenant del JWT  
async function getCustomers() {  
  const { data: { user } } \= await supabase.auth.getUser()  
  const tenantId \= user.user\_metadata.tenant\_id  // Del JWT  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  const { data } \= await supabase  
    .from('customers')  
    .select('\*')  
  // RLS filtra automáticamente  
    
  return data  
}  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Setup de RLS  
\- \[ \] \`ALTER TABLE x ENABLE ROW LEVEL SECURITY\` ejecutado  
\- \[ \] Policy creada para SELECT  
\- \[ \] Policy creada para INSERT  
\- \[ \] Policy creada para UPDATE  
\- \[ \] Policy creada para DELETE  
\- \[ \] (O una policy FOR ALL que cubra todo)

\#\#\# Testing  
\- \[ \] Tenant A no ve datos de Tenant B (SELECT)  
\- \[ \] No se puede insertar con tenant\_id de otro (INSERT)  
\- \[ \] No se puede cambiar tenant\_id en UPDATE  
\- \[ \] No se puede eliminar datos de otro tenant (DELETE)  
\- \[ \] JOINs respetan RLS en ambas tablas

\#\#\# Integración  
\- \[ \] Backend setea tenant\_id ANTES de queries  
\- \[ \] Edge Functions llaman set\_tenant\_context()  
\- \[ \] Service Role Key setea tenant explícitamente  
\- \[ \] Frontend NUNCA controla tenant\_id

\#\#\# Performance  
\- \[ \] Index en tenant\_id existe  
\- \[ \] EXPLAIN ANALYZE muestra uso del index  
\- \[ \] Queries comunes \<100ms  
\- \[ \] No hay full table scans en queries frecuentes

\---

\#\# 📊 Métricas de Éxito

RLS funciona correctamente si:  
\- ✅ 100% de tablas multi-tenant tienen RLS habilitado  
\- ✅ 100% de tests de aislamiento pasan  
\- ✅ 0 queries pueden acceder a datos de otros tenants  
\- ✅ Performance aceptable (queries \<100ms)  
\- ✅ Logs de auditoría muestran tenant\_id correcto

\---

\#\# 💡 Para Pato (Uso en PymePilot)

\#\#\# Workflow estándar

\*\*Al crear tabla nueva:\*\*  
\`\`\`  
@db-architect usando /skills/database/multi-tenant-rls.md  
agregá RLS completo a tabla nueva\_tabla  
\`\`\`

\*\*Al modificar tabla existente:\*\*  
\`\`\`  
@db-architect verificá que RLS de tabla\_x sigue funcionando  
después de agregar columna nueva\_columna  
\`\`\`

\*\*Testing de aislamiento:\*\*  
\`\`\`  
@db-architect usando /skills/database/multi-tenant-rls.md  
testeá aislamiento de tenant en tabla\_x  
\`\`\`

\#\#\# Script de verificación rápida  
\`\`\`bash  
\#\!/bin/bash  
\# Verificar RLS en todas las tablas

psql $DATABASE\_URL \-c "  
SELECT   
    tablename,  
    rowsecurity as rls\_enabled,  
    (SELECT COUNT(\*) FROM pg\_policies WHERE tablename \= t.tablename) as policy\_count  
FROM pg\_tables t  
WHERE schemaname \= 'public'  
AND tablename NOT IN ('tenants', 'migrations')  
ORDER BY tablename;  
"  
\`\`\`

Output esperado:  
\`\`\`  
   tablename    | rls\_enabled | policy\_count   
\----------------+-------------+--------------  
 customers      | t           |            1  
 products       | t           |            1  
 predictions    | t           |            1  
 orders         | t           |            1  
\`\`\`

Si alguna tabla tiene \`rls\_enabled \= f\` → PROBLEMA

\---  
