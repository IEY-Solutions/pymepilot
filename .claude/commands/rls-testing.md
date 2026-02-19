---
name: rls-testing
description: Testing de Row Level Security en PostgreSQL multi-tenant
---

\# Skill: RLS Testing (Row Level Security)

\#\# 🎯 Qué es  
Sistema de testing para verificar que las políticas de Row Level Security (RLS) en PostgreSQL funcionan correctamente y PREVIENEN data leakage entre tenants.

\*\*Analogía Simple:\*\*  
RLS es como tener un edificio con departamentos (tenants):  
\- Cada inquilino (tenant) tiene su propia llave  
\- Cuando abre la puerta, SOLO ve su departamento  
\- NO puede entrar ni ver los departamentos de otros

En PostgreSQL:  
\- Cada query incluye "qué tenant soy"  
\- RLS filtra automáticamente: SOLO devuelve datos de ese tenant  
\- Si RLS falla → Tenant A puede ver datos de Tenant B (DESASTRE)

\*\*Por qué es CRÍTICO para PymePilot:\*\*  
Si IEY (tenant 1\) puede ver datos de otro distribuidor (tenant 2):  
\- ❌ Violación de privacidad  
\- ❌ Exposición de estrategias comerciales  
\- ❌ Potencial demanda legal  
\- ❌ Pérdida total de confianza

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Después de crear CADA tabla nueva  
\- ✅ Después de modificar CUALQUIER RLS policy  
\- ✅ Antes de CADA deployment a producción  
\- ✅ En CI/CD pipeline (tests automáticos)

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Agregás columnas nuevas a tablas con RLS  
\- ⚠️ Modificás estructura de tenancy (ej: agregar sub-tenants)  
\- ⚠️ Integrás nuevos servicios que acceden a la DB  
\- ⚠️ Detectás comportamiento raro en producción

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Anatomía de una RLS Policy

\*\*Componente 1: Habilitar RLS en la tabla\*\*  
\`\`\`sql  
\-- Sin esto, RLS NO funciona (tabla completamente abierta)  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;  
\`\`\`

\*\*Componente 2: Crear la Policy\*\*  
\`\`\`sql  
\-- Policy para operaciones SELECT  
CREATE POLICY "tenant\_isolation\_policy" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\*\*Desglose de la policy:\*\*  
\- \`FOR SELECT\` → Aplica solo a queries SELECT (también existe FOR INSERT, UPDATE, DELETE)  
\- \`USING (...)\` → Condición que debe cumplirse para ver la row  
\- \`current\_setting('app.tenant\_id')\` → Variable de sesión con el tenant actual  
\- \`::uuid\` → Cast a UUID para comparar con tenant\_id

\*\*Componente 3: Setear el tenant\_id en cada sesión\*\*  
\`\`\`python  
\# Antes de CADA query, setear el tenant  
conn.execute("SET app.tenant\_id \= %s", (tenant\_id,))

\# Ahora todas las queries respetan RLS  
results \= conn.execute("SELECT \* FROM customers")  
\# Solo devuelve customers de ese tenant\_id  
\`\`\`

\#\#\# Práctica 2: Policies Completas (CRUD)

\*\*Para tabla \`customers\` en PymePilot:\*\*  
\`\`\`sql  
\-- Habilitar RLS  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

\-- Policy para SELECT (lectura)  
CREATE POLICY "tenant\_select\_policy" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para INSERT (creación)  
CREATE POLICY "tenant\_insert\_policy" ON customers  
    FOR INSERT  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para UPDATE (modificación)  
CREATE POLICY "tenant\_update\_policy" ON customers  
    FOR UPDATE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Policy para DELETE (eliminación)  
CREATE POLICY "tenant\_delete\_policy" ON customers  
    FOR DELETE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\*\*Diferencia USING vs WITH CHECK:\*\*  
\- \`USING\`: Qué rows puede VER/MODIFICAR  
\- \`WITH CHECK\`: Qué valores puede INSERTAR/ACTUALIZAR

Ejemplo:  
\`\`\`sql  
\-- Solo puede modificar customers de su tenant  
USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)

\-- Y NO puede cambiar el tenant\_id al modificar  
WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
\`\`\`

\#\#\# Práctica 3: Testing Automatizado de RLS

\*\*Script de testing: \`tests/test\_rls.py\`\*\*  
\`\`\`python  
import psycopg  
import pytest  
import os  
from uuid import uuid4

\# Tenants de prueba  
TENANT\_IEY \= uuid4()  
TENANT\_DEMO \= uuid4()

@pytest.fixture  
def db\_connection():  
    """Conexión a PostgreSQL de testing"""  
    conn \= psycopg.connect(os.getenv('TEST\_DATABASE\_URL'))  
    yield conn  
    conn.close()

def setup\_test\_data(conn):  
    """Crear datos de prueba para 2 tenants"""  
      
    \# Insertar customers para IEY  
    conn.execute("""  
        INSERT INTO customers (id, tenant\_id, name, email)  
        VALUES   
            (gen\_random\_uuid(), %s, 'Cliente IEY 1', 'cliente1@iey.com'),  
            (gen\_random\_uuid(), %s, 'Cliente IEY 2', 'cliente2@iey.com')  
    """, (TENANT\_IEY, TENANT\_IEY))  
      
    \# Insertar customers para DEMO  
    conn.execute("""  
        INSERT INTO customers (id, tenant\_id, name, email)  
        VALUES   
            (gen\_random\_uuid(), %s, 'Cliente DEMO 1', 'cliente1@demo.com'),  
            (gen\_random\_uuid(), %s, 'Cliente DEMO 2', 'cliente2@demo.com')  
    """, (TENANT\_DEMO, TENANT\_DEMO))  
      
    conn.commit()

def test\_rls\_select\_isolation(db\_connection):  
    """  
    TEST 1: Verificar que tenant IEY NO puede ver datos de tenant DEMO  
    """  
    conn \= db\_connection  
    setup\_test\_data(conn)  
      
    \# Setear sesión como tenant IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Query sin WHERE (RLS debe filtrar automáticamente)  
    result \= conn.execute("SELECT \* FROM customers").fetchall()  
      
    \# Verificaciones  
    assert len(result) \== 2, f"IEY debería ver solo 2 customers, vio {len(result)}"  
      
    for row in result:  
        assert row\['tenant\_id'\] \== TENANT\_IEY, \\  
            f"IEY vio customer de otro tenant: {row\['tenant\_id'\]}"  
        assert 'IEY' in row\['name'\], \\  
            f"IEY vio customer que no es suyo: {row\['name'\]}"  
      
    print("✅ TEST PASADO: IEY solo ve sus propios customers")

def test\_rls\_insert\_enforcement(db\_connection):  
    """  
    TEST 2: Verificar que NO se puede insertar con tenant\_id incorrecto  
    """  
    conn \= db\_connection  
      
    \# Setear sesión como tenant IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Intentar insertar customer para OTRO tenant (debe fallar)  
    try:  
        conn.execute("""  
            INSERT INTO customers (id, tenant\_id, name, email)  
            VALUES (gen\_random\_uuid(), %s, 'Hacker Customer', 'hack@evil.com')  
        """, (str(TENANT\_DEMO),))  
          
        conn.commit()  
          
        \# Si llegamos acá, el test FALLÓ (debería haber lanzado error)  
        assert False, "❌ RLS permitió insertar con tenant\_id incorrecto"  
          
    except psycopg.errors.InsufficientPrivilege:  
        \# Esperábamos este error \- RLS bloqueó el insert  
        conn.rollback()  
        print("✅ TEST PASADO: RLS bloqueó insert con tenant\_id incorrecto")

def test\_rls\_update\_prevention(db\_connection):  
    """  
    TEST 3: Verificar que NO se puede cambiar tenant\_id en UPDATE  
    """  
    conn \= db\_connection  
    setup\_test\_data(conn)  
      
    \# Setear sesión como tenant IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Obtener un customer de IEY  
    customer \= conn.execute(  
        "SELECT id FROM customers LIMIT 1"  
    ).fetchone()  
      
    \# Intentar cambiar su tenant\_id a DEMO (debe fallar)  
    try:  
        conn.execute("""  
            UPDATE customers   
            SET tenant\_id \= %s   
            WHERE id \= %s  
        """, (str(TENANT\_DEMO), customer\['id'\]))  
          
        conn.commit()  
          
        assert False, "❌ RLS permitió cambiar tenant\_id en UPDATE"  
          
    except psycopg.errors.InsufficientPrivilege:  
        conn.rollback()  
        print("✅ TEST PASADO: RLS bloqueó cambio de tenant\_id")

def test\_rls\_delete\_isolation(db\_connection):  
    """  
    TEST 4: Verificar que NO se puede eliminar customers de otro tenant  
    """  
    conn \= db\_connection  
    setup\_test\_data(conn)  
      
    \# Setear sesión como tenant IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Obtener ID de un customer de DEMO  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_DEMO),))  
    demo\_customer \= conn.execute(  
        "SELECT id FROM customers LIMIT 1"  
    ).fetchone()  
      
    \# Volver a sesión de IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Intentar eliminar customer de DEMO (debe fallar silenciosamente)  
    result \= conn.execute("""  
        DELETE FROM customers WHERE id \= %s  
    """, (demo\_customer\['id'\],))  
      
    rows\_deleted \= result.rowcount  
      
    assert rows\_deleted \== 0, \\  
        f"❌ IEY pudo eliminar {rows\_deleted} customer(s) de DEMO"  
      
    print("✅ TEST PASADO: IEY no puede eliminar customers de DEMO")

def test\_rls\_cross\_table\_join(db\_connection):  
    """  
    TEST 5: Verificar RLS en JOINs entre tablas  
    """  
    conn \= db\_connection  
      
    \# Crear productos para ambos tenants  
    conn.execute("""  
        INSERT INTO products (id, tenant\_id, name, price)  
        VALUES   
            (gen\_random\_uuid(), %s, 'Producto IEY', 100),  
            (gen\_random\_uuid(), %s, 'Producto DEMO', 200\)  
    """, (TENANT\_IEY, TENANT\_DEMO))  
      
    \# Crear pedidos vinculando customer con producto  
    conn.execute("""  
        INSERT INTO orders (id, tenant\_id, customer\_id, product\_id, total)  
        SELECT   
            gen\_random\_uuid(),  
            c.tenant\_id,  
            c.id,  
            p.id,  
            p.price  
        FROM customers c  
        CROSS JOIN products p  
        WHERE c.tenant\_id \= p.tenant\_id  
    """)  
      
    conn.commit()  
      
    \# Setear sesión como IEY  
    conn.execute("SET app.tenant\_id \= %s", (str(TENANT\_IEY),))  
      
    \# Query con JOIN  
    result \= conn.execute("""  
        SELECT o.\*, c.name as customer\_name, p.name as product\_name  
        FROM orders o  
        JOIN customers c ON o.customer\_id \= c.id  
        JOIN products p ON o.product\_id \= p.id  
    """).fetchall()  
      
    \# Verificar que TODOS los resultados son del tenant IEY  
    for row in result:  
        assert row\['tenant\_id'\] \== TENANT\_IEY, \\  
            f"JOIN devolvió data de otro tenant: {row}"  
      
    print("✅ TEST PASADO: RLS funciona correctamente en JOINs")

\# Ejecutar todos los tests  
if \_\_name\_\_ \== '\_\_main\_\_':  
    pytest.main(\[\_\_file\_\_, '-v'\])  
\`\`\`

\*\*Ejecutar tests:\*\*  
\`\`\`bash  
\# Instalar pytest si no lo tenés  
pip install pytest psycopg \--break-system-packages

\# Configurar DB de testing  
export TEST\_DATABASE\_URL="postgresql://user:pass@localhost:5432/pymepilot\_test"

\# Ejecutar tests  
pytest tests/test\_rls.py \-v

\# Output esperado:  
\# test\_rls\_select\_isolation PASSED ✅  
\# test\_rls\_insert\_enforcement PASSED ✅  
\# test\_rls\_update\_prevention PASSED ✅  
\# test\_rls\_delete\_isolation PASSED ✅  
\# test\_rls\_cross\_table\_join PASSED ✅  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: RLS en Supabase Edge Function

\*\*Edge Function: \`get-predictions.ts\`\*\*  
\`\`\`typescript  
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) \=\> {  
  const supabase \= createClient(  
    Deno.env.get('SUPABASE\_URL')\!,  
    Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
  )  
    
  // Obtener usuario autenticado  
  const authHeader \= req.headers.get('Authorization')\!  
  const token \= authHeader.replace('Bearer ', '')  
    
  const { data: { user }, error: authError } \= await supabase.auth.getUser(token)  
    
  if (authError || \!user) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  // Obtener tenant\_id del JWT  
  const tenantId \= user.user\_metadata.tenant\_id  
    
  // ✅ CRÍTICO: Setear tenant\_id en la sesión de PostgreSQL  
  await supabase.rpc('set\_tenant\_context', { tenant\_id: tenantId })  
    
  // Ahora RLS filtra automáticamente  
  const { data: predictions } \= await supabase  
    .from('predictions')  
    .select('\*')  
    .order('created\_at', { ascending: false })  
    .limit(100)  
    
  // Solo devuelve predictions del tenant del usuario  
  return new Response(JSON.stringify(predictions), {  
    headers: { 'Content-Type': 'application/json' }  
  })  
})  
\`\`\`

\*\*SQL Function \`set\_tenant\_context\`:\*\*  
\`\`\`sql  
\-- Función para setear tenant\_id en la sesión  
CREATE OR REPLACE FUNCTION set\_tenant\_context(tenant\_id uuid)  
RETURNS void  
LANGUAGE plpgsql  
SECURITY DEFINER  
AS $$  
BEGIN  
    PERFORM set\_config('app.tenant\_id', tenant\_id::text, false);  
END;  
$$;  
\`\`\`

\#\#\# Ejemplo 2: RLS en Python Backend

\*\*Módulo: \`db/session.py\`\*\*  
\`\`\`python  
import psycopg  
import os  
from contextlib import contextmanager  
from uuid import UUID

class TenantSession:  
    """Sesión de DB con tenant context"""  
      
    def \_\_init\_\_(self, tenant\_id: UUID):  
        self.tenant\_id \= tenant\_id  
        self.conn \= None  
      
    def \_\_enter\_\_(self):  
        """Abrir conexión y setear tenant"""  
        self.conn \= psycopg.connect(os.getenv('DATABASE\_URL'))  
          
        \# ✅ CRÍTICO: Setear tenant ANTES de cualquier query  
        self.conn.execute(  
            "SET app.tenant\_id \= %s",  
            (str(self.tenant\_id),)  
        )  
          
        return self.conn  
      
    def \_\_exit\_\_(self, exc\_type, exc\_val, exc\_tb):  
        """Cerrar conexión"""  
        if self.conn:  
            self.conn.close()

\# Uso en vertical de Activación  
def get\_customers\_to\_activate(tenant\_id: UUID):  
    """Obtener clientes inactivos para activar"""  
      
    with TenantSession(tenant\_id) as conn:  
        \# RLS filtra automáticamente por tenant\_id  
        result \= conn.execute("""  
            SELECT   
                id,  
                name,  
                email,  
                phone,  
                last\_purchase\_date  
            FROM customers  
            WHERE status \= 'inactive'  
            AND last\_purchase\_date \< NOW() \- INTERVAL '90 days'  
            ORDER BY last\_purchase\_date DESC  
            LIMIT 50  
        """).fetchall()  
          
        return result

\# ❌ NUNCA hacer esto (sin tenant context)  
def get\_customers\_bad():  
    conn \= psycopg.connect(os.getenv('DATABASE\_URL'))  
    \# Sin SET app.tenant\_id → RLS no funciona → ve TODOS los tenants  
    result \= conn.execute("SELECT \* FROM customers").fetchall()  
    return result  
\`\`\`

\#\#\# Ejemplo 3: Testing Manual de RLS

\*\*Script: \`scripts/test-rls-manual.sh\`\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Testing manual de RLS para PymePilot

DB\_URL="postgresql://pymepilot\_user:password@localhost:5432/pymepilot\_db"

echo "🧪 TESTING MANUAL DE RLS"  
echo "========================"  
echo ""

\# Tenant IDs de prueba  
TENANT\_IEY="123e4567-e89b-12d3-a456-426614174000"  
TENANT\_DEMO="123e4567-e89b-12d3-a456-426614174001"

echo "📊 Setup: Insertando datos de prueba..."

psql "$DB\_URL" \<\<EOF  
\-- Insertar customers para IEY  
INSERT INTO customers (id, tenant\_id, name, email) VALUES  
    (gen\_random\_uuid(), '$TENANT\_IEY', 'Test IEY 1', 'test1@iey.com'),  
    (gen\_random\_uuid(), '$TENANT\_IEY', 'Test IEY 2', 'test2@iey.com');

\-- Insertar customers para DEMO  
INSERT INTO customers (id, tenant\_id, name, email) VALUES  
    (gen\_random\_uuid(), '$TENANT\_DEMO', 'Test DEMO 1', 'test1@demo.com'),  
    (gen\_random\_uuid(), '$TENANT\_DEMO', 'Test DEMO 2', 'test2@demo.com');  
EOF

echo "✅ Datos insertados"  
echo ""

\# TEST 1: IEY solo ve sus customers  
echo "TEST 1: IEY solo debe ver 2 customers (suyos)"  
echo "----------------------------------------------"

RESULT=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_IEY';  
    SELECT COUNT(\*) FROM customers;  
")

if \[ "$RESULT" \-eq 2 \]; then  
    echo "✅ PASÓ \- IEY ve exactamente 2 customers"  
else  
    echo "❌ FALLÓ \- IEY ve $RESULT customers (esperaba 2)"  
fi

echo ""

\# TEST 2: DEMO solo ve sus customers  
echo "TEST 2: DEMO solo debe ver 2 customers (suyos)"  
echo "-----------------------------------------------"

RESULT=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_DEMO';  
    SELECT COUNT(\*) FROM customers;  
")

if \[ "$RESULT" \-eq 2 \]; then  
    echo "✅ PASÓ \- DEMO ve exactamente 2 customers"  
else  
    echo "❌ FALLÓ \- DEMO ve $RESULT customers (esperaba 2)"  
fi

echo ""

\# TEST 3: Sin tenant context → ERROR  
echo "TEST 3: Query sin tenant\_id debe fallar o ver 0 rows"  
echo "----------------------------------------------------"

RESULT=$(psql "$DB\_URL" \-t \-c "  
    SELECT COUNT(\*) FROM customers;  
" 2\>&1)

if \[\[ "$RESULT" \== \*"ERROR"\* \]\] || \[ "$RESULT" \-eq 0 \]; then  
    echo "✅ PASÓ \- Query sin tenant bloqueada o sin resultados"  
else  
    echo "❌ FALLÓ \- Query sin tenant devolvió $RESULT rows"  
fi

echo ""  
echo "🧹 Limpieza: Borrando datos de prueba..."

psql "$DB\_URL" \<\<EOF  
DELETE FROM customers WHERE email LIKE '%@iey.com' OR email LIKE '%@demo.com';  
EOF

echo "✅ Limpieza completa"  
echo ""  
echo "🎉 TESTING FINALIZADO"  
\`\`\`

\*\*Ejecutar:\*\*  
\`\`\`bash  
chmod \+x scripts/test-rls-manual.sh  
./scripts/test-rls-manual.sh  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: Olvidar habilitar RLS  
\`\`\`sql  
\-- ❌ MAL \- RLS no habilitado  
CREATE TABLE customers (  
    id UUID PRIMARY KEY,  
    tenant\_id UUID NOT NULL,  
    name TEXT  
);

CREATE POLICY "tenant\_policy" ON customers  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Problema: La policy existe pero NO se aplica porque RLS está deshabilitado  
\`\`\`

\*\*Fix:\*\*  
\`\`\`sql  
\-- ✅ BIEN  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

\-- Verificar que está habilitado  
SELECT tablename, rowsecurity   
FROM pg\_tables   
WHERE schemaname \= 'public' AND tablename \= 'customers';

\-- Debe mostrar: rowsecurity \= true  
\`\`\`

\#\#\# Error 2: Policy solo para SELECT  
\`\`\`sql  
\-- ❌ MAL \- Solo policy para SELECT  
CREATE POLICY "tenant\_select" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Problema: INSERT, UPDATE, DELETE NO tienen policies → quedan BLOQUEADOS  
\`\`\`

\*\*Fix:\*\*  
\`\`\`sql  
\-- ✅ BIEN \- Policies para TODAS las operaciones  
CREATE POLICY "tenant\_select" ON customers  
    FOR SELECT  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_insert" ON customers  
    FOR INSERT  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_update" ON customers  
    FOR UPDATE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

CREATE POLICY "tenant\_delete" ON customers  
    FOR DELETE  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\#\#\# Error 3: No setear tenant\_id en la sesión  
\`\`\`python  
\# ❌ MAL  
conn \= psycopg.connect(DATABASE\_URL)  
\# Sin SET app.tenant\_id  
result \= conn.execute("SELECT \* FROM customers").fetchall()  
\# RLS intenta leer current\_setting('app.tenant\_id') → ERROR o devuelve vacío  
\`\`\`

\*\*Fix:\*\*  
\`\`\`python  
\# ✅ BIEN  
conn \= psycopg.connect(DATABASE\_URL)  
conn.execute("SET app.tenant\_id \= %s", (tenant\_id,))  
result \= conn.execute("SELECT \* FROM customers").fetchall()  
\`\`\`

\#\#\# Error 4: Usar Service Role Key sin setear tenant  
\`\`\`typescript  
// ❌ MAL \- Service Role bypasea RLS  
const supabase \= createClient(  
    SUPABASE\_URL,  
    SUPABASE\_SERVICE\_ROLE\_KEY // ← Bypasea RLS por defecto  
)

const { data } \= await supabase.from('customers').select('\*')  
// Devuelve TODOS los customers de TODOS los tenants  
\`\`\`

\*\*Fix:\*\*  
\`\`\`typescript  
// ✅ BIEN \- Setear tenant antes de queries  
const supabase \= createClient(SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY)

// Setear tenant context  
await supabase.rpc('set\_tenant\_context', { tenant\_id: user.user\_metadata.tenant\_id })

// Ahora RLS funciona  
const { data } \= await supabase.from('customers').select('\*')  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Antes de aprobar RLS en una tabla:

\#\#\#\# Setup Básico  
\- \[ \] RLS habilitado: \`ALTER TABLE x ENABLE ROW LEVEL SECURITY;\`  
\- \[ \] Tabla tiene columna \`tenant\_id UUID NOT NULL\`  
\- \[ \] Index en \`tenant\_id\` para performance  
\- \[ \] Foreign key a tabla \`tenants\` si existe

\#\#\#\# Policies Creadas  
\- \[ \] Policy para SELECT  
\- \[ \] Policy para INSERT  
\- \[ \] Policy para UPDATE  
\- \[ \] Policy para DELETE  
\- \[ \] Todas las policies usan \`current\_setting('app.tenant\_id')\`

\#\#\#\# Testing Ejecutado  
\- \[ \] Test: Tenant A NO ve datos de Tenant B  
\- \[ \] Test: INSERT con tenant\_id incorrecto es rechazado  
\- \[ \] Test: UPDATE no puede cambiar tenant\_id  
\- \[ \] Test: DELETE solo afecta rows del tenant actual  
\- \[ \] Test: JOINs respetan RLS en ambas tablas

\#\#\#\# Integración  
\- \[ \] Backend setea \`app.tenant\_id\` ANTES de queries  
\- \[ \] Edge Functions llaman \`set\_tenant\_context()\`  
\- \[ \] Frontend NUNCA manda tenant\_id (viene del JWT)  
\- \[ \] Tests automáticos en CI/CD

\---

\#\# 📊 Métricas de Éxito

Un sistema de RLS PASA si:  
\- ✅ 100% de tablas con tenant\_id tienen RLS habilitado  
\- ✅ 100% de tests de aislamiento pasan  
\- ✅ 0 queries pueden ver datos de otros tenants  
\- ✅ INSERT/UPDATE con tenant\_id incorrecto fallan  
\- ✅ JOINs respetan RLS en todas las tablas

\---

\#\# 🔗 Referencias

\- \[PostgreSQL RLS Documentation\](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)  
\- \[Supabase RLS Guide\](https://supabase.com/docs/guides/auth/row-level-security)  
\- \[Multi-Tenancy Patterns\](https://www.citusdata.com/blog/2016/10/03/designing-your-saas-database-for-high-scalability/)

\---

\#\# 💡 Para Pato (Uso en PymePilot)

\#\#\# Tablas que VAN A NECESITAR RLS

Basado en la arquitectura de PymePilot:  
\`\`\`sql  
\-- Core tables  
customers          ← RLS CRÍTICO  
products           ← RLS CRÍTICO  
predictions        ← RLS CRÍTICO  
whatsapp\_messages  ← RLS CRÍTICO  
orders             ← RLS CRÍTICO

\-- Config tables  
vertical\_configs   ← RLS necesario  
user\_preferences   ← RLS necesario  
api\_usage\_logs     ← RLS para auditoría

\-- Admin tables (multi-tenant awareness)  
tenants            ← Sin RLS (tabla maestra)  
users              ← RLS por tenant\_id  
\`\`\`

\#\#\# Workflow con Claude Code

\*\*Paso 1: Crear tabla nueva\*\*  
\`\`\`  
@db-architect creá tabla products con tenant\_id  
\`\`\`

\*\*Paso 2: Agregar RLS inmediatamente\*\*  
\`\`\`  
@security-guardian usando /skills/security/rls-testing.md  
agregá RLS completo a tabla products  
\`\`\`

\*\*Paso 3: Testear antes de deployment\*\*  
\`\`\`  
pytest tests/test\_rls\_products.py \-v  
\`\`\`

\#\#\# Debugging RLS en producción

Si sospechás que RLS está fallando:  
\`\`\`sql  
\-- Ver policies activas  
SELECT \* FROM pg\_policies WHERE tablename \= 'customers';

\-- Ver si RLS está habilitado  
SELECT relname, relrowsecurity   
FROM pg\_class   
WHERE relname \= 'customers';

\-- Testear manualmente  
SET app.tenant\_id \= 'uuid-de-iey';  
SELECT COUNT(\*) FROM customers; \-- Debería ser solo customers de IEY  
\`\`\`

\---  
