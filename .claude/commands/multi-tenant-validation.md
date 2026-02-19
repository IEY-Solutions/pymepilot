---
name: multi-tenant-validation
description: Valida aislamiento de datos entre tenants en todas las operaciones
---

\# Skill: Multi-Tenant Validation

\#\# 🎯 Qué es  
Sistema de validación end-to-end para garantizar aislamiento completo entre tenants en TODA la aplicación (DB, backend, frontend, APIs externas).

\*\*Analogía Simple:\*\*  
Imaginate un hotel con habitaciones (tenants):  
\- Cada huésped tiene su tarjeta magnética (auth token)  
\- La tarjeta SOLO abre SU habitación  
\- No puede abrir otras habitaciones  
\- No puede ver qué hay en otras habitaciones  
\- No puede modificar cosas de otras habitaciones

En PymePilot:  
\- IEY (tenant 1\) SOLO ve/modifica sus clientes, productos, predicciones  
\- Tenant DEMO (tenant 2\) está 100% aislado de IEY  
\- Un bug en aislamiento \= desastre legal \+ pérdida de confianza

\*\*Por qué es CRÍTICO:\*\*  
Si un tenant puede:  
\- ❌ Ver clientes de otro tenant → Violación de privacidad  
\- ❌ Ver predicciones de otro tenant → Exposición de estrategia comercial  
\- ❌ Modificar datos de otro tenant → Sabotaje  
\- ❌ Eliminar datos de otro tenant → Destrucción de información

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Antes de CADA deployment a producción  
\- ✅ Después de modificar lógica de autenticación  
\- ✅ Después de agregar nuevas features que tocan data  
\- ✅ Antes de onboardear nuevo cliente (tenant)

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Modificás estructura de tenancy  
\- ⚠️ Agregás roles/permisos nuevos  
\- ⚠️ Integrás servicios third-party (Kommo, WhatsApp)  
\- ⚠️ Modificás Edge Functions o API routes

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Testing de Capas (Layer Testing)

Multi-tenant validation debe cubrir TODAS las capas:  
\`\`\`  
┌─────────────────────────────────┐  
│ CAPA 1: Frontend (Next.js)      │ ← Test: UI solo muestra data del tenant  
├─────────────────────────────────┤  
│ CAPA 2: API Routes              │ ← Test: Endpoints validan tenant  
├─────────────────────────────────┤  
│ CAPA 3: Edge Functions          │ ← Test: Functions setean tenant context  
├─────────────────────────────────┤  
│ CAPA 4: PostgreSQL RLS          │ ← Test: DB filtra por tenant  
├─────────────────────────────────┤  
│ CAPA 5: Integraciones Externas  │ ← Test: Webhooks validan tenant  
└─────────────────────────────────┘  
\`\`\`

\#\#\# Práctica 2: Test Suite Completo

\*\*Archivo: \`tests/test\_multi\_tenant\_validation.py\`\*\*  
\`\`\`python  
import pytest  
import requests  
from uuid import uuid4  
from supabase import create\_client

\# Tenants de prueba  
TENANT\_IEY \= {  
    'id': uuid4(),  
    'name': 'IEY',  
    'email': 'test@iey.com'  
}

TENANT\_DEMO \= {  
    'id': uuid4(),  
    'name': 'DEMO',  
    'email': 'test@demo.com'  
}

@pytest.fixture  
def supabase\_client():  
    """Cliente de Supabase para testing"""  
    return create\_client(  
        os.getenv('SUPABASE\_URL'),  
        os.getenv('SUPABASE\_SERVICE\_ROLE\_KEY')  
    )

@pytest.fixture  
def setup\_tenants(supabase\_client):  
    """Crear tenants de prueba"""  
      
    \# Crear tenant IEY  
    supabase\_client.table('tenants').insert({  
        'id': str(TENANT\_IEY\['id'\]),  
        'name': TENANT\_IEY\['name'\],  
        'email': TENANT\_IEY\['email'\]  
    }).execute()  
      
    \# Crear tenant DEMO  
    supabase\_client.table('tenants').insert({  
        'id': str(TENANT\_DEMO\['id'\]),  
        'name': TENANT\_DEMO\['name'\],  
        'email': TENANT\_DEMO\['email'\]  
    }).execute()  
      
    yield  
      
    \# Cleanup  
    supabase\_client.table('tenants').delete().eq('id', str(TENANT\_IEY\['id'\])).execute()  
    supabase\_client.table('tenants').delete().eq('id', str(TENANT\_DEMO\['id'\])).execute()

\# \==================== CAPA 1: DATABASE \====================

def test\_database\_isolation(supabase\_client, setup\_tenants):  
    """  
    Verificar que RLS funciona en PostgreSQL  
    """  
      
    \# Insertar customers para cada tenant  
    supabase\_client.table('customers').insert(\[  
        {'tenant\_id': str(TENANT\_IEY\['id'\]), 'name': 'Cliente IEY 1'},  
        {'tenant\_id': str(TENANT\_IEY\['id'\]), 'name': 'Cliente IEY 2'},  
        {'tenant\_id': str(TENANT\_DEMO\['id'\]), 'name': 'Cliente DEMO 1'},  
        {'tenant\_id': str(TENANT\_DEMO\['id'\]), 'name': 'Cliente DEMO 2'},  
    \]).execute()  
      
    \# Setear contexto de IEY  
    supabase\_client.rpc('set\_tenant\_context', {'tenant\_id': str(TENANT\_IEY\['id'\])}).execute()  
      
    \# Query sin filtro explícito (RLS debe filtrar)  
    result \= supabase\_client.table('customers').select('\*').execute()  
      
    \# Verificaciones  
    assert len(result.data) \== 2, f"IEY debe ver 2 customers, vio {len(result.data)}"  
      
    for customer in result.data:  
        assert customer\['tenant\_id'\] \== str(TENANT\_IEY\['id'\]), \\  
            f"IEY vio customer de otro tenant"  
      
    print("✅ DATABASE ISOLATION: PASÓ")

\# \==================== CAPA 2: API ROUTES \====================

def test\_api\_route\_isolation():  
    """  
    Verificar que API routes validan tenant correctamente  
    """  
      
    \# Crear usuarios de testing  
    iey\_user \= create\_test\_user(TENANT\_IEY\['id'\], 'user@iey.com')  
    demo\_user \= create\_test\_user(TENANT\_DEMO\['id'\], 'user@demo.com')  
      
    \# Login como IEY user  
    iey\_token \= get\_auth\_token('user@iey.com', 'password123')  
      
    \# Request a /api/customers  
    response \= requests.get(  
        'https://pymepilot.cloud/api/customers',  
        headers={'Authorization': f'Bearer {iey\_token}'}  
    )  
      
    assert response.status\_code \== 200  
    customers \= response.json()  
      
    \# Verificar que TODOS los customers son de IEY  
    for customer in customers:  
        assert customer\['tenant\_id'\] \== str(TENANT\_IEY\['id'\]), \\  
            f"API devolvió customer de otro tenant"  
      
    \# Intentar acceder con token de DEMO a mismo endpoint  
    demo\_token \= get\_auth\_token('user@demo.com', 'password123')  
      
    response \= requests.get(  
        'https://pymepilot.cloud/api/customers',  
        headers={'Authorization': f'Bearer {demo\_token}'}  
    )  
      
    demo\_customers \= response.json()  
      
    \# NO debe haber overlap  
    iey\_ids \= {c\['id'\] for c in customers}  
    demo\_ids \= {c\['id'\] for c in demo\_customers}  
      
    assert len(iey\_ids & demo\_ids) \== 0, \\  
        "❌ CRÍTICO: Hay customers compartidos entre tenants"  
      
    print("✅ API ROUTE ISOLATION: PASÓ")

\# \==================== CAPA 3: EDGE FUNCTIONS \====================

def test\_edge\_function\_isolation():  
    """  
    Verificar que Edge Functions respetan tenant context  
    """  
      
    \# Invocar edge function como IEY  
    iey\_token \= get\_auth\_token('user@iey.com', 'password123')  
      
    response \= requests.post(  
        'https://xyzcompany.supabase.co/functions/v1/get-predictions',  
        headers={'Authorization': f'Bearer {iey\_token}'},  
        json={'vertical': 'activacion', 'limit': 50}  
    )  
      
    assert response.status\_code \== 200  
    predictions \= response.json()  
      
    \# Verificar tenant\_id en TODAS las predictions  
    for pred in predictions:  
        assert pred\['tenant\_id'\] \== str(TENANT\_IEY\['id'\]), \\  
            f"Edge Function devolvió prediction de otro tenant"  
      
    print("✅ EDGE FUNCTION ISOLATION: PASÓ")

\# \==================== CAPA 4: FRONTEND \====================

def test\_frontend\_data\_isolation(playwright\_page):  
    """  
    Verificar que frontend solo muestra data del tenant autenticado  
    """  
      
    \# Login como IEY user  
    playwright\_page.goto('https://pymepilot.cloud/login')  
    playwright\_page.fill('input\[name="email"\]', 'user@iey.com')  
    playwright\_page.fill('input\[name="password"\]', 'password123')  
    playwright\_page.click('button\[type="submit"\]')  
      
    \# Esperar dashboard  
    playwright\_page.wait\_for\_selector('\[data-testid="dashboard"\]')  
      
    \# Verificar que header muestra nombre del tenant  
    tenant\_name \= playwright\_page.text\_content('\[data-testid="tenant-name"\]')  
    assert tenant\_name \== 'IEY', f"Header muestra tenant incorrecto: {tenant\_name}"  
      
    \# Ir a página de customers  
    playwright\_page.goto('https://pymepilot.cloud/customers')  
      
    \# Obtener TODOS los customers visibles en la tabla  
    customer\_rows \= playwright\_page.query\_selector\_all('\[data-testid="customer-row"\]')  
      
    for row in customer\_rows:  
        \# Verificar que NO hay indicadores de otro tenant  
        \# (ej: badge, color, etc. que identifique tenant)  
        text \= row.text\_content()  
        assert 'DEMO' not in text, "❌ Frontend muestra data de DEMO en sesión de IEY"  
      
    print("✅ FRONTEND ISOLATION: PASÓ")

\# \==================== CAPA 5: INTEGRACIONES EXTERNAS \====================

def test\_webhook\_tenant\_validation():  
    """  
    Verificar que webhooks de Kommo/WhatsApp validan tenant correctamente  
    """  
      
    \# Simular webhook de Kommo para IEY  
    webhook\_payload \= {  
        'leads': {  
            'add': \[{  
                'id': 123456,  
                'name': 'Nuevo Lead IEY',  
                'custom\_fields': \[  
                    {'id': 'tenant\_id', 'values': \[{'value': str(TENANT\_IEY\['id'\])}\]}  
                \]  
            }\]  
        }  
    }  
      
    \# Signature HMAC correcta  
    signature \= generate\_hmac\_signature(webhook\_payload, KOMMO\_SECRET\_IEY)  
      
    response \= requests.post(  
        'https://pymepilot.cloud/api/webhooks/kommo',  
        json=webhook\_payload,  
        headers={'X-Kommo-Signature': signature}  
    )  
      
    assert response.status\_code \== 200  
      
    \# Verificar que lead se creó en tenant correcto  
    supabase\_client.rpc('set\_tenant\_context', {'tenant\_id': str(TENANT\_IEY\['id'\])}).execute()  
      
    leads \= supabase\_client.table('leads').select('\*').eq('external\_id', 123456).execute()  
      
    assert len(leads.data) \== 1  
    assert leads.data\[0\]\['tenant\_id'\] \== str(TENANT\_IEY\['id'\])  
      
    \# Intentar enviar webhook con firma de otro tenant (debe fallar)  
    malicious\_payload \= webhook\_payload.copy()  
    malicious\_payload\['leads'\]\['add'\]\[0\]\['custom\_fields'\]\[0\]\['values'\]\[0\]\['value'\] \= str(TENANT\_DEMO\['id'\])  
      
    \# Usar signature de IEY para payload de DEMO  
    response \= requests.post(  
        'https://pymepilot.cloud/api/webhooks/kommo',  
        json=malicious\_payload,  
        headers={'X-Kommo-Signature': signature}  
    )  
      
    \# Debe rechazar (signature no coincide con payload)  
    assert response.status\_code \== 401, "❌ Webhook no validó signature correctamente"  
      
    print("✅ WEBHOOK ISOLATION: PASÓ")

\# \==================== TEST DE ATAQUES \====================

def test\_tenant\_id\_injection\_attack():  
    """  
    Intentar inyectar tenant\_id en requests (debe fallar)  
    """  
      
    iey\_token \= get\_auth\_token('user@iey.com', 'password123')  
      
    \# Ataque 1: Intentar mandar tenant\_id en query params  
    response \= requests.get(  
        'https://pymepilot.cloud/api/customers?tenant\_id=' \+ str(TENANT\_DEMO\['id'\]),  
        headers={'Authorization': f'Bearer {iey\_token}'}  
    )  
      
    customers \= response.json()  
      
    \# NO debe devolver customers de DEMO  
    for customer in customers:  
        assert customer\['tenant\_id'\] \!= str(TENANT\_DEMO\['id'\]), \\  
            "❌ CRÍTICO: Query param injection funcionó"  
      
    \# Ataque 2: Intentar mandar tenant\_id en body  
    response \= requests.post(  
        'https://pymepilot.cloud/api/customers',  
        headers={'Authorization': f'Bearer {iey\_token}'},  
        json={  
            'name': 'Hacker Customer',  
            'tenant\_id': str(TENANT\_DEMO\['id'\])  \# Intentar crear en otro tenant  
        }  
    )  
      
    \# Verificar que se creó en tenant de IEY (del token), NO en DEMO  
    if response.status\_code \== 201:  
        created \= response.json()  
        assert created\['tenant\_id'\] \== str(TENANT\_IEY\['id'\]), \\  
            "❌ CRÍTICO: Body injection funcionó"  
      
    print("✅ INJECTION ATTACK PREVENTION: PASÓ")

def test\_jwt\_token\_tampering():  
    """  
    Intentar modificar tenant\_id en JWT token (debe fallar)  
    """  
      
    iey\_token \= get\_auth\_token('user@iey.com', 'password123')  
      
    \# Decodificar JWT (sin verificar signature)  
    import jwt  
    payload \= jwt.decode(iey\_token, options={"verify\_signature": False})  
      
    \# Modificar tenant\_id en payload  
    payload\['user\_metadata'\]\['tenant\_id'\] \= str(TENANT\_DEMO\['id'\])  
      
    \# Re-encodear (sin signature correcta)  
    tampered\_token \= jwt.encode(payload, 'fake-secret', algorithm='HS256')  
      
    \# Intentar usar token modificado  
    response \= requests.get(  
        'https://pymepilot.cloud/api/customers',  
        headers={'Authorization': f'Bearer {tampered\_token}'}  
    )  
      
    \# Debe rechazar (signature inválida)  
    assert response.status\_code \== 401, \\  
        "❌ CRÍTICO: Token tampering no fue detectado"  
      
    print("✅ JWT TAMPERING PREVENTION: PASÓ")

\# \==================== HELPER FUNCTIONS \====================

def create\_test\_user(tenant\_id, email):  
    """Crear usuario de testing"""  
    \# Implementación específica con Supabase Auth  
    pass

def get\_auth\_token(email, password):  
    """Obtener JWT token para testing"""  
    \# Implementación específica con Supabase Auth  
    pass

def generate\_hmac\_signature(payload, secret):  
    """Generar HMAC signature para webhook"""  
    import hmac  
    import hashlib  
    import json  
      
    message \= json.dumps(payload, sort\_keys=True)  
    signature \= hmac.new(  
        secret.encode(),  
        message.encode(),  
        hashlib.sha256  
    ).hexdigest()  
      
    return signature

\# \==================== EJECUTAR TESTS \====================

if \_\_name\_\_ \== '\_\_main\_\_':  
    pytest.main(\[\_\_file\_\_, '-v', '--tb=short'\])  
\`\`\`

\*\*Ejecutar test suite:\*\*  
\`\`\`bash  
\# Instalar dependencias  
pip install pytest requests playwright \--break-system-packages  
playwright install

\# Ejecutar tests  
pytest tests/test\_multi\_tenant\_validation.py \-v

\# Output esperado:  
\# test\_database\_isolation PASSED ✅  
\# test\_api\_route\_isolation PASSED ✅  
\# test\_edge\_function\_isolation PASSED ✅  
\# test\_frontend\_data\_isolation PASSED ✅  
\# test\_webhook\_tenant\_validation PASSED ✅  
\# test\_tenant\_id\_injection\_attack PASSED ✅  
\# test\_jwt\_token\_tampering PASSED ✅  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: Confiar en frontend para tenant\_id  
\`\`\`typescript  
// ❌ MAL \- Frontend manda tenant\_id  
async function getCustomers(tenantId: string) {  
  const { data } \= await supabase  
    .from('customers')  
    .select('\*')  
    .eq('tenant\_id', tenantId)  // ← Usuario controla esto  
    
  return data  
}

// ✅ BIEN \- Tenant viene del JWT (backend)  
async function getCustomers() {  
  const { data: { user } } \= await supabase.auth.getUser()  
  const tenantId \= user.user\_metadata.tenant\_id  
    
  const { data } \= await supabase  
    .from('customers')  
    .select('\*')  
    .eq('tenant\_id', tenantId)  
    
  return data  
}  
\`\`\`

\#\#\# Error 2: No validar tenant en CADA request  
\`\`\`typescript  
// ❌ MAL \- Validación solo en login  
app.post('/login', validateTenant, loginHandler)  
app.get('/api/customers', getCustomers)  // ← Sin validación

// ✅ BIEN \- Middleware en TODAS las rutas  
app.use('/api/\*', validateTenantMiddleware)  
app.post('/login', loginHandler)  
app.get('/api/customers', getCustomers)  
\`\`\`

\#\#\# Error 3: Queries sin tenant context  
\`\`\`python  
\# ❌ MAL  
def get\_predictions():  
    conn \= psycopg.connect(DATABASE\_URL)  
    \# Sin SET app.tenant\_id  
    result \= conn.execute("SELECT \* FROM predictions").fetchall()  
    return result

\# ✅ BIEN  
def get\_predictions(tenant\_id):  
    with TenantSession(tenant\_id) as conn:  
        result \= conn.execute("SELECT \* FROM predictions").fetchall()  
        return result  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Pre-Deployment  
\- \[ \] Test suite completo ejecutado → 100% pasando  
\- \[ \] Audit de código → sin tenant\_id hardcodeados  
\- \[ \] RLS policies testeadas en TODAS las tablas  
\- \[ \] Edge Functions setean tenant context

\#\#\# Cada Capa Validada  
\- \[ \] Database: RLS filtra correctamente  
\- \[ \] API Routes: Validan tenant del JWT  
\- \[ \] Edge Functions: Setean tenant context  
\- \[ \] Frontend: Solo muestra data del tenant  
\- \[ \] Webhooks: Validan signatures y tenant

\#\#\# Ataques Prevenidos  
\- \[ \] Tenant ID injection en query params → bloqueado  
\- \[ \] Tenant ID injection en request body → bloqueado  
\- \[ \] JWT token tampering → detectado y rechazado  
\- \[ \] Cross-tenant data access → imposible

\---

\#\# 📊 Métricas de Éxito

Sistema multi-tenant SEGURO si:  
\- ✅ 0 queries devuelven data de otros tenants  
\- ✅ 100% de tests de aislamiento pasan  
\- ✅ 100% de intentos de injection fallan  
\- ✅ JWT tampering es detectado siempre  
\- ✅ Webhooks validan signatures correctamente

\---

\#\# 💡 Para Pato (Checklist Práctica)

\#\#\# Antes de onboardear nuevo cliente  
\`\`\`bash  
\# 1\. Crear tenant en DB  
INSERT INTO tenants (id, name, email, created\_at)  
VALUES (gen\_random\_uuid(), 'Nombre Cliente', 'email@cliente.com', NOW());

\# 2\. Ejecutar test suite con nuevo tenant  
pytest tests/test\_multi\_tenant\_validation.py \--tenant-id=nuevo-uuid \-v

\# 3\. Verificar RLS manualmente  
psql pymepilot\_db  
SET app.tenant\_id \= 'nuevo-uuid';  
SELECT COUNT(\*) FROM customers;  \-- Debe ser 0 (tenant nuevo)

\# 4\. Crear usuario admin para ese tenant  
\-- En Supabase dashboard o vía API

\# 5\. Testear login \+ dashboard  
\-- Login como nuevo tenant  
\-- Verificar que ve 0 data (está vacío)  
\-- Crear 1 customer de prueba  
\-- Verificar que SOLO ve ese customer

\# 6\. ✅ Solo DESPUÉS de validar → entregar credenciales al cliente  
\`\`\`

\---  
