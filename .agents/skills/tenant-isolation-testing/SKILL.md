\# Skill: Tenant Isolation Testing

\#\# 🎯 Qué es  
Suite completa de tests para verificar que el aislamiento entre tenants funciona PERFECTAMENTE en PymePilot. Garantiza que cada tenant solo puede ver/modificar sus propios datos, y NUNCA acceder a datos de otros tenants.

\*\*Analogía Simple:\*\*  
Es como hacer inspección de seguridad en un edificio de departamentos:  
\- Verificar que cada llave solo abre SU departamento  
\- Intentar abrir otras puertas (deben estar cerradas)  
\- Verificar que no se puede ver por ventanas de otros  
\- Confirmar que paredes son gruesas (no se escucha nada)

En PymePilot:  
\- Tenant A NO puede ver datos de Tenant B  
\- Tenant A NO puede modificar datos de Tenant B  
\- Tenant A NO puede eliminar datos de Tenant B  
\- Esto debe ser IMPOSIBLE (no "difícil")

\*\*Por qué es CRÍTICO:\*\*  
\- IEY confía en que nadie ve sus datos  
\- Violación \= pérdida de confianza \+ problemas legales  
\- Un bug puede exponer datos de todos los tenants  
\- Testing previene desastres ANTES de producción

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Después de crear tabla nueva con RLS  
\- ✅ Después de modificar RLS policies  
\- ✅ Antes de CADA deployment  
\- ✅ Después de cambios en autenticación

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Agregás features que tocan múltiples tenants  
\- ⚠️ Modificás lógica de multi-tenancy  
\- ⚠️ Onboardeás nuevo tenant  
\- ⚠️ Detectás comportamiento raro en producción

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Test Suite Completo en pytest

\*\*Estructura de tests:\*\*  
\`\`\`  
tests/  
├── test\_tenant\_isolation.py          \# Tests de DB (RLS)  
├── test\_api\_tenant\_isolation.py      \# Tests de API routes  
├── test\_frontend\_isolation.py        \# Tests de UI (Playwright)  
└── fixtures/  
    └── tenant\_fixtures.py            \# Fixtures de tenants de prueba  
\`\`\`

\*\*Archivo: \`tests/fixtures/tenant\_fixtures.py\`\*\*  
\`\`\`python  
import pytest  
from uuid import uuid4  
import psycopg  
import os

@pytest.fixture(scope="session")  
def db\_connection():  
    """Conexión a DB de testing"""  
    conn \= psycopg.connect(os.getenv('TEST\_DATABASE\_URL'))  
    yield conn  
    conn.close()

@pytest.fixture(scope="function")  
def test\_tenants(db\_connection):  
    """Crear 2 tenants de prueba"""  
      
    tenant\_a\_id \= uuid4()  
    tenant\_b\_id \= uuid4()  
      
    \# Crear tenants  
    db\_connection.execute("""  
        INSERT INTO tenants (id, name, email) VALUES  
            (%s, 'Test Tenant A', 'a@test.com'),  
            (%s, 'Test Tenant B', 'b@test.com')  
    """, (tenant\_a\_id, tenant\_b\_id))  
      
    \# Crear customers para cada tenant  
    db\_connection.execute("""  
        INSERT INTO customers (tenant\_id, name, email) VALUES  
            (%s, 'Customer A1', 'a1@test.com'),  
            (%s, 'Customer A2', 'a2@test.com'),  
            (%s, 'Customer B1', 'b1@test.com'),  
            (%s, 'Customer B2', 'b2@test.com')  
    """, (tenant\_a\_id, tenant\_a\_id, tenant\_b\_id, tenant\_b\_id))  
      
    db\_connection.commit()  
      
    yield {  
        'tenant\_a': tenant\_a\_id,  
        'tenant\_b': tenant\_b\_id  
    }  
      
    \# Cleanup  
    db\_connection.execute(  
        "DELETE FROM tenants WHERE id IN (%s, %s)",  
        (tenant\_a\_id, tenant\_b\_id)  
    )  
    db\_connection.commit()  
\`\`\`

\*\*Archivo: \`tests/test\_tenant\_isolation.py\`\*\*  
\`\`\`python  
import pytest  
from uuid import UUID

def test\_select\_isolation(db\_connection, test\_tenants):  
    """  
    TEST 1: Tenant A solo ve sus propios customers  
    """  
    tenant\_a \= test\_tenants\['tenant\_a'\]  
    tenant\_b \= test\_tenants\['tenant\_b'\]  
      
    \# Setear contexto de Tenant A  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_a),))  
      
    \# Query SIN filtro explícito por tenant\_id  
    result \= db\_connection.execute("""  
        SELECT \* FROM customers ORDER BY name  
    """).fetchall()  
      
    \# Verificar que SOLO ve sus customers  
    assert len(result) \== 2, f"Tenant A debe ver 2 customers, vio {len(result)}"  
      
    for row in result:  
        assert row\['tenant\_id'\] \== tenant\_a, \\  
            f"Tenant A vio customer de otro tenant: {row\['tenant\_id'\]}"  
        assert 'A' in row\['name'\], \\  
            f"Tenant A vio customer que no es suyo: {row\['name'\]}"  
      
    print("✅ SELECT isolation: PASSED")

def test\_insert\_isolation(db\_connection, test\_tenants):  
    """  
    TEST 2: Tenant A NO puede insertar con tenant\_id de Tenant B  
    """  
    tenant\_a \= test\_tenants\['tenant\_a'\]  
    tenant\_b \= test\_tenants\['tenant\_b'\]  
      
    \# Setear contexto de Tenant A  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_a),))  
      
    \# Intentar insertar customer con tenant\_id de Tenant B  
    with pytest.raises(Exception) as exc\_info:  
        db\_connection.execute("""  
            INSERT INTO customers (tenant\_id, name, email)  
            VALUES (%s, 'Hacker Customer', 'hack@evil.com')  
        """, (str(tenant\_b),))  
        db\_connection.commit()  
      
    \# Debe fallar con error de RLS  
    assert "row-level security policy" in str(exc\_info.value).lower()  
      
    db\_connection.rollback()  
      
    print("✅ INSERT isolation: PASSED")

def test\_update\_isolation(db\_connection, test\_tenants):  
    """  
    TEST 3: Tenant A NO puede cambiar tenant\_id en UPDATE  
    """  
    tenant\_a \= test\_tenants\['tenant\_a'\]  
    tenant\_b \= test\_tenants\['tenant\_b'\]  
      
    \# Setear contexto de Tenant A  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_a),))  
      
    \# Obtener un customer de Tenant A  
    customer \= db\_connection.execute("""  
        SELECT id FROM customers LIMIT 1  
    """).fetchone()  
      
    \# Intentar cambiar su tenant\_id a Tenant B  
    with pytest.raises(Exception) as exc\_info:  
        db\_connection.execute("""  
            UPDATE customers   
            SET tenant\_id \= %s   
            WHERE id \= %s  
        """, (str(tenant\_b), customer\['id'\]))  
        db\_connection.commit()  
      
    assert "row-level security policy" in str(exc\_info.value).lower()  
      
    db\_connection.rollback()  
      
    print("✅ UPDATE isolation: PASSED")

def test\_delete\_isolation(db\_connection, test\_tenants):  
    """  
    TEST 4: Tenant A NO puede eliminar customers de Tenant B  
    """  
    tenant\_a \= test\_tenants\['tenant\_a'\]  
    tenant\_b \= test\_tenants\['tenant\_b'\]  
      
    \# Obtener ID de customer de Tenant B  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_b),))  
    customer\_b \= db\_connection.execute("""  
        SELECT id FROM customers LIMIT 1  
    """).fetchone()  
      
    \# Cambiar a contexto de Tenant A  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_a),))  
      
    \# Intentar eliminar customer de Tenant B  
    result \= db\_connection.execute("""  
        DELETE FROM customers WHERE id \= %s  
    """, (customer\_b\['id'\],))  
      
    rows\_deleted \= result.rowcount  
      
    \# RLS debe prevenir la eliminación (0 rows afectadas)  
    assert rows\_deleted \== 0, \\  
        f"Tenant A pudo eliminar {rows\_deleted} customer(s) de Tenant B"  
      
    db\_connection.rollback()  
      
    print("✅ DELETE isolation: PASSED")

def test\_join\_isolation(db\_connection, test\_tenants):  
    """  
    TEST 5: JOINs entre tablas respetan RLS de ambas  
    """  
    tenant\_a \= test\_tenants\['tenant\_a'\]  
    tenant\_b \= test\_tenants\['tenant\_b'\]  
      
    \# Crear products para cada tenant  
    db\_connection.execute("""  
        INSERT INTO products (tenant\_id, sku, name, price) VALUES  
            (%s, 'SKU-A1', 'Product A1', 100),  
            (%s, 'SKU-B1', 'Product B1', 200\)  
    """, (tenant\_a, tenant\_b))  
    db\_connection.commit()  
      
    \# Setear contexto de Tenant A  
    db\_connection.execute("SET app.tenant\_id \= %s", (str(tenant\_a),))  
      
    \# Query con JOIN customers \<-\> products  
    result \= db\_connection.execute("""  
        SELECT c.name as customer, p.name as product  
        FROM customers c  
        CROSS JOIN products p  
    """).fetchall()  
      
    \# Verificar que TODOS los resultados son de Tenant A  
    for row in result:  
        assert 'A' in row\['customer'\], \\  
            f"JOIN devolvió customer de otro tenant: {row\['customer'\]}"  
        assert 'A' in row\['product'\], \\  
            f"JOIN devolvió product de otro tenant: {row\['product'\]}"  
      
    print("✅ JOIN isolation: PASSED")

def test\_no\_context\_returns\_empty(db\_connection, test\_tenants):  
    """  
    TEST 6: Sin tenant\_id seteado → 0 resultados o ERROR  
    """  
    \# Reset tenant context  
    db\_connection.execute("RESET app.tenant\_id")  
      
    \# Query sin contexto  
    try:  
        result \= db\_connection.execute("SELECT \* FROM customers").fetchall()  
          
        \# Si no da error, debe retornar 0 rows  
        assert len(result) \== 0, \\  
            f"Query sin tenant context retornó {len(result)} rows (esperaba 0)"  
          
    except Exception as e:  
        \# O puede dar error (también válido)  
        assert "unrecognized configuration parameter" in str(e).lower() or \\  
               "invalid input syntax" in str(e).lower()  
      
    print("✅ No context isolation: PASSED")  
\`\`\`

\#\#\# Práctica 2: Testing de API Routes

\*\*Archivo: \`tests/test\_api\_tenant\_isolation.py\`\*\*  
\`\`\`python  
import pytest  
import requests  
from uuid import uuid4

BASE\_URL \= "http://localhost:3000"

@pytest.fixture  
def auth\_tokens(test\_tenants):  
    """Crear usuarios y obtener tokens para cada tenant"""  
      
    \# Crear usuarios (usando Supabase Admin API o similar)  
    user\_a \= create\_user\_for\_tenant(  
        test\_tenants\['tenant\_a'\],  
        'usera@test.com',  
        'password123'  
    )  
      
    user\_b \= create\_user\_for\_tenant(  
        test\_tenants\['tenant\_b'\],  
        'userb@test.com',  
        'password123'  
    )  
      
    \# Login y obtener tokens  
    token\_a \= login\_and\_get\_token('usera@test.com', 'password123')  
    token\_b \= login\_and\_get\_token('userb@test.com', 'password123')  
      
    yield {  
        'token\_a': token\_a,  
        'token\_b': token\_b,  
        'user\_a': user\_a,  
        'user\_b': user\_b  
    }  
      
    \# Cleanup  
    delete\_user(user\_a\['id'\])  
    delete\_user(user\_b\['id'\])

def test\_api\_get\_customers\_isolation(auth\_tokens):  
    """  
    TEST: GET /api/customers solo retorna customers del tenant del token  
    """  
      
    \# Request como Tenant A  
    response\_a \= requests.get(  
        f"{BASE\_URL}/api/customers",  
        headers={'Authorization': f'Bearer {auth\_tokens\["token\_a"\]}'}  
    )  
      
    assert response\_a.status\_code \== 200  
    customers\_a \= response\_a.json()  
      
    \# Verificar que TODOS son de Tenant A  
    for customer in customers\_a:  
        assert customer\['email'\].startswith('a'), \\  
            f"Tenant A recibió customer de otro tenant: {customer\['email'\]}"  
      
    \# Request como Tenant B  
    response\_b \= requests.get(  
        f"{BASE\_URL}/api/customers",  
        headers={'Authorization': f'Bearer {auth\_tokens\["token\_b"\]}'}  
    )  
      
    assert response\_b.status\_code \== 200  
    customers\_b \= response\_b.json()  
      
    \# Verificar que TODOS son de Tenant B  
    for customer in customers\_b:  
        assert customer\['email'\].startswith('b'), \\  
            f"Tenant B recibió customer de otro tenant: {customer\['email'\]}"  
      
    \# Verificar que NO hay overlap  
    emails\_a \= {c\['email'\] for c in customers\_a}  
    emails\_b \= {c\['email'\] for c in customers\_b}  
      
    assert len(emails\_a & emails\_b) \== 0, \\  
        f"Hay customers compartidos entre tenants: {emails\_a & emails\_b}"  
      
    print("✅ API GET isolation: PASSED")

def test\_api\_tenant\_injection\_blocked(auth\_tokens, test\_tenants):  
    """  
    TEST: Intentar inyectar tenant\_id en request → debe ser ignorado  
    """  
      
    \# Intentar crear customer para Tenant B usando token de Tenant A  
    response \= requests.post(  
        f"{BASE\_URL}/api/customers",  
        headers={'Authorization': f'Bearer {auth\_tokens\["token\_a"\]}'},  
        json={  
            'name': 'Hacker Customer',  
            'email': 'hack@evil.com',  
            'tenant\_id': str(test\_tenants\['tenant\_b'\])  \# Inyección  
        }  
    )  
      
    if response.status\_code \== 201:  
        created \= response.json()  
          
        \# tenant\_id del request debe ser IGNORADO  
        \# Debe usar tenant\_id del token (Tenant A)  
        assert created\['tenant\_id'\] \== str(test\_tenants\['tenant\_a'\]), \\  
            f"API permitió inyección de tenant\_id"  
      
    print("✅ API injection prevention: PASSED")  
\`\`\`

\#\#\# Práctica 3: Automated Testing en CI/CD

\*\*Archivo: \`.github/workflows/tenant-isolation-tests.yml\`\*\*  
\`\`\`yaml  
name: Tenant Isolation Tests

on:  
  push:  
    branches: \[main, staging\]  
  pull\_request:  
    branches: \[main\]

jobs:  
  isolation-tests:  
    runs-on: ubuntu-latest  
      
    services:  
      postgres:  
        image: postgres:15  
        env:  
          POSTGRES\_PASSWORD: postgres  
          POSTGRES\_DB: pymepilot\_test  
        options: \>-  
          \--health-cmd pg\_isready  
          \--health-interval 10s  
          \--health-timeout 5s  
          \--health-retries 5  
        ports:  
          \- 5432:5432  
      
    steps:  
      \- uses: actions/checkout@v3  
        
      \- name: Set up Python  
        uses: actions/setup-python@v4  
        with:  
          python-version: '3.11'  
        
      \- name: Install dependencies  
        run: |  
          pip install pytest psycopg requests  
        
      \- name: Run migrations  
        env:  
          DATABASE\_URL: postgresql://postgres:postgres@localhost:5432/pymepilot\_test  
        run: |  
          psql $DATABASE\_URL \-f migrations/001\_create\_tenants.sql  
          psql $DATABASE\_URL \-f migrations/002\_create\_customers.sql  
          \# ... resto de migrations  
        
      \- name: Run tenant isolation tests  
        env:  
          TEST\_DATABASE\_URL: postgresql://postgres:postgres@localhost:5432/pymepilot\_test  
        run: |  
          pytest tests/test\_tenant\_isolation.py \-v  
        
      \- name: Fail if any test failed  
        if: failure()  
        run: |  
          echo "❌ Tenant isolation tests FAILED"  
          echo "🛑 DO NOT MERGE \- Security vulnerability detected"  
          exit 1  
\`\`\`

\#\#\# Práctica 4: Testing Manual con Script

\*\*Archivo: \`scripts/test\_tenant\_isolation.sh\`\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Testing manual de tenant isolation

DB\_URL="postgresql://user:pass@localhost:5432/pymepilot\_db"

echo "🧪 TENANT ISOLATION TEST SUITE"  
echo "==============================="  
echo ""

\# IDs de tenants (IEY y DEMO)  
TENANT\_IEY="123e4567-e89b-12d3-a456-426614174000"  
TENANT\_DEMO="987fcdeb-51a2-43d7-8f9e-ba0987654321"

ERRORS=0

\# TEST 1: IEY solo ve sus customers  
echo "TEST 1: Tenant IEY isolation"  
echo "----------------------------"

COUNT\_IEY=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_IEY';  
    SELECT COUNT(\*) FROM customers;  
")

echo "IEY ve $COUNT\_IEY customers"

\# Verificar que ninguno es de DEMO  
LEAKED=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_IEY';  
    SELECT COUNT(\*) FROM customers WHERE email LIKE '%demo%';  
")

if \[ "$LEAKED" \-gt 0 \]; then  
    echo "❌ FAILED: IEY ve $LEAKED customers de DEMO"  
    ((ERRORS++))  
else  
    echo "✅ PASSED: IEY no ve customers de DEMO"  
fi

echo ""

\# TEST 2: DEMO solo ve sus customers  
echo "TEST 2: Tenant DEMO isolation"  
echo "------------------------------"

COUNT\_DEMO=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_DEMO';  
    SELECT COUNT(\*) FROM customers;  
")

echo "DEMO ve $COUNT\_DEMO customers"

LEAKED=$(psql "$DB\_URL" \-t \-c "  
    SET app.tenant\_id \= '$TENANT\_DEMO';  
    SELECT COUNT(\*) FROM customers WHERE email LIKE '%iey%';  
")

if \[ "$LEAKED" \-gt 0 \]; then  
    echo "❌ FAILED: DEMO ve $LEAKED customers de IEY"  
    ((ERRORS++))  
else  
    echo "✅ PASSED: DEMO no ve customers de IEY"  
fi

echo ""

\# TEST 3: Sin contexto → 0 results  
echo "TEST 3: No tenant context"  
echo "-------------------------"

COUNT\_NO\_CTX=$(psql "$DB\_URL" \-t \-c "  
    RESET app.tenant\_id;  
    SELECT COUNT(\*) FROM customers;  
" 2\>&1)

if \[\[ "$COUNT\_NO\_CTX" \== \*"ERROR"\* \]\] || \[ "$COUNT\_NO\_CTX" \-eq 0 \]; then  
    echo "✅ PASSED: Sin contexto no retorna data"  
else  
    echo "❌ FAILED: Sin contexto retornó $COUNT\_NO\_CTX rows"  
    ((ERRORS++))  
fi

echo ""

\# TEST 4: Intentar insertar con tenant\_id de otro  
echo "TEST 4: INSERT injection attempt"  
echo "---------------------------------"

psql "$DB\_URL" \<\<EOF 2\>&1 | grep \-q "row-level security"  
    SET app.tenant\_id \= '$TENANT\_IEY';  
    INSERT INTO customers (tenant\_id, name, email)  
    VALUES ('$TENANT\_DEMO', 'Hacker', 'hack@evil.com');  
EOF

if \[ $? \-eq 0 \]; then  
    echo "✅ PASSED: INSERT injection blocked by RLS"  
else  
    echo "❌ FAILED: INSERT injection NOT blocked"  
    ((ERRORS++))  
fi

echo ""

\# RESUMEN  
echo "=============================="  
if \[ $ERRORS \-eq 0 \]; then  
    echo "🎉 ALL TESTS PASSED"  
    echo "✅ Tenant isolation is working correctly"  
    exit 0  
else  
    echo "⚠️  $ERRORS TEST(S) FAILED"  
    echo "❌ Tenant isolation has issues"  
    echo "🛑 DO NOT DEPLOY TO PRODUCTION"  
    exit 1  
fi  
\`\`\`

\*\*Ejecutar:\*\*  
\`\`\`bash  
chmod \+x scripts/test\_tenant\_isolation.sh  
./scripts/test\_tenant\_isolation.sh  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: No testear TODAS las operaciones  
\`\`\`python  
\# ❌ MAL \- Solo testear SELECT  
def test\_isolation(db):  
    \# ... solo test de SELECT

\# ✅ BIEN \- Testear SELECT, INSERT, UPDATE, DELETE  
def test\_select\_isolation(db): ...  
def test\_insert\_isolation(db): ...  
def test\_update\_isolation(db): ...  
def test\_delete\_isolation(db): ...  
\`\`\`

\#\#\# Error 2: Testear solo en DB (omitir API)  
\`\`\`python  
\# ❌ MAL \- Solo tests de DB  
\# RLS puede funcionar, pero API puede tener bug

\# ✅ BIEN \- Tests en TODAS las capas  
tests/  
├── test\_tenant\_isolation.py        \# DB layer  
├── test\_api\_tenant\_isolation.py    \# API layer  
└── test\_frontend\_isolation.py      \# UI layer  
\`\`\`

\#\#\# Error 3: Usar datos de producción para testing  
\`\`\`python  
\# ❌ MAL  
TENANT\_IEY\_PROD \= "uuid-real-de-iey"  
\# Testing con datos reales

\# ✅ BIEN  
@pytest.fixture  
def test\_tenants():  
    \# Crear tenants de PRUEBA  
    tenant\_a \= create\_test\_tenant()  
    tenant\_b \= create\_test\_tenant()  
    yield ...  
    \# Cleanup  
\`\`\`

\#\#\# Error 4: No verificar cross-contamination  
\`\`\`python  
\# ❌ MAL \- Solo verificar que A ve sus datos  
assert len(customers\_a) \== 2

\# ✅ BIEN \- Verificar que A NO ve datos de B  
assert len(customers\_a) \== 2  
for c in customers\_a:  
    assert c\['tenant\_id'\] \== tenant\_a\_id  
    assert c\['tenant\_id'\] \!= tenant\_b\_id  \# Explícito  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Test Suite Completo  
\- \[ \] Tests de SELECT isolation  
\- \[ \] Tests de INSERT injection prevention  
\- \[ \] Tests de UPDATE tenant\_id prevention  
\- \[ \] Tests de DELETE isolation  
\- \[ \] Tests de JOINs multi-tabla  
\- \[ \] Tests de queries sin tenant context  
\- \[ \] Tests de API routes  
\- \[ \] Tests de frontend (si aplica)

\#\#\# Cobertura de Tablas  
\- \[ \] customers ✅  
\- \[ \] products ✅  
\- \[ \] predictions ✅  
\- \[ \] orders ✅  
\- \[ \] whatsapp\_messages ✅  
\- \[ \] (todas las tablas con tenant\_id)

\#\#\# CI/CD Integration  
\- \[ \] Tests automáticos en cada PR  
\- \[ \] Tests ejecutados antes de merge  
\- \[ \] Pipeline falla si tests fallan  
\- \[ \] Resultados visibles en PR

\#\#\# Documentación  
\- \[ \] README con instrucciones de testing  
\- \[ \] Ejemplos de cómo agregar tests  
\- \[ \] Troubleshooting guide  
\- \[ \] Contacto si tests fallan

\---

\#\# 📊 Métricas de Éxito

Tenant isolation SEGURO si:  
\- ✅ 100% de tests pasan  
\- ✅ 0 data leakage entre tenants  
\- ✅ Tests corren en \<30 segundos  
\- ✅ Cobertura de TODAS las tablas multi-tenant  
\- ✅ Tests en CI/CD bloquean merges inseguros

\---

\#\# 💡 Para Pato (Workflow Diario)

\#\#\# Antes de cada deployment  
\`\`\`bash  
\# 1\. Ejecutar test suite completo  
pytest tests/test\_tenant\_isolation.py \-v

\# 2\. Si alguno falla → STOP  
\# NO deployar hasta corregir

\# 3\. Si todos pasan → safe to deploy  
\`\`\`

\#\#\# Al agregar tabla nueva  
\`\`\`python  
\# 1\. Crear tabla con RLS  
\# 2\. INMEDIATAMENTE agregar tests

@pytest.fixture  
def test\_nueva\_tabla(db, test\_tenants):  
    \# Setup data para tests  
    ...

def test\_nueva\_tabla\_select\_isolation(db, test\_nueva\_tabla):  
    \# Verificar aislamiento SELECT  
    ...

def test\_nueva\_tabla\_insert\_isolation(db, test\_nueva\_tabla):  
    \# Verificar injection prevention  
    ...

\# 3\. Ejecutar tests  
pytest tests/test\_tenant\_isolation.py::test\_nueva\_tabla\* \-v  
\`\`\`

\#\#\# Debugging de fallos  
\`\`\`bash  
\# Si un test falla:

\# 1\. Ver logs detallados  
pytest tests/test\_tenant\_isolation.py \-v \-s

\# 2\. Ejecutar solo ese test  
pytest tests/test\_tenant\_isolation.py::test\_select\_isolation \-v

\# 3\. Agregar prints para debugging  
def test\_select\_isolation(db):  
    result \= db.execute("SELECT \* FROM customers").fetchall()  
    print(f"DEBUG: Got {len(result)} rows")  
    for row in result:  
        print(f"  \- {row\['tenant\_id'\]} | {row\['name'\]}")  
    ...

\# 4\. Verificar RLS manualmente  
psql $DATABASE\_URL  
SET app.tenant\_id \= 'uuid-a';  
SELECT \* FROM customers;  
\`\`\`

\---  
