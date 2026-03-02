# Onboarding de Nuevos Distribuidores

Guia paso a paso para dar de alta un nuevo distribuidor en PymePilot.

---

## Pre-requisitos

Antes de empezar, necesitas tener:

1. **Datos del distribuidor:**
   - Nombre completo (ej: "Distribuidora Garcia SRL")
   - Slug (identificador corto, solo minusculas y guiones: "garcia")
   - Tipo de ERP (contabilium, excel, xubio, alegra, colppy, custom)
   - Verticales a activar (reposicion, activacion, recuperacion, cross_sell)

2. **Credenciales del usuario admin:**
   - Email del admin del distribuidor
   - Password (minimo 6 caracteres)

3. **Credenciales ERP (si tiene API):**
   - Client ID de la API del ERP
   - Client Secret de la API del ERP
   - Solo para ERPs con API (Contabilium, Xubio, etc.). Excel no necesita.

4. **Acceso al VPS:**
   - SSH al servidor como usuario `pato`
   - El venv de Python activado o usar la ruta completa

---

## Ejecutar el script

```bash
# Conectar al VPS
ssh pato@tu-servidor

# Ir al directorio del proyecto
cd ~/projects/pymepilot

# Ejecutar el script de onboarding
backend/venv/bin/python backend/scripts/create_tenant.py
```

### Que esperar en cada paso

**Paso 1 — Datos del tenant:**
El script pide nombre, slug, tipo de ERP y verticales. Valida cada campo
contra las restricciones de la base de datos.

**Paso 2 — Crear tenant en DB:**
Inserta el registro en la tabla `tenants`. Si el slug ya existe
(por ejemplo, si ejecutaste el script antes y fallo en un paso posterior),
ofrece continuar con el tenant existente.

**Paso 3 — Crear usuario admin:**
Pide email y password. Crea el usuario en GoTrue (autenticacion de Supabase)
con `app_metadata.tenant_id` (necesario para que RLS funcione).
Tambien crea el perfil en `user_profiles` con rol `admin`.

**Paso 4 — Credenciales ERP:**
Solo aparece si el tipo de ERP tiene API (no para `excel`).
Pide Client ID y Client Secret por getpass (no se muestran en pantalla).
Los encripta con Fernet y los guarda en `tenants.erp_config`.

**Paso 5 — Verificacion:**
Ejecuta 3 checks automaticos:
- RLS: verifica que el nuevo tenant no ve datos de otros tenants
- Profile: verifica que el perfil de usuario existe
- Tenant: verifica que el registro esta activo

---

## Verificacion post-onboarding

Despues de ejecutar el script, verificar manualmente:

### 1. Login en el dashboard

Abrir `app.pymepilot.cloud` e iniciar sesion con el email/password del admin.
Deberia ver el dashboard vacio (sin datos aun).

### 2. Primer sync (si tiene API)

```bash
# Test de conexion (no sincroniza datos, solo verifica que la API responde)
backend/venv/bin/python backend/scripts/sync_erp.py --tenant-slug SLUG --test-only

# Sync limitado (5 registros por entidad, para verificar mapeo)
backend/venv/bin/python backend/scripts/sync_erp.py --tenant-slug SLUG --limit 5

# Sync completo
backend/venv/bin/python backend/scripts/sync_erp.py --tenant-slug SLUG
```

### 3. Primer carga (si es Excel)

El distribuidor puede subir archivos desde:
- **Smart File Upload:** Pagina /datos en el dashboard
- **Google Drive:** Configurar carpeta compartida (ver docs/setup-drive)

### 4. Verificar datos

```bash
# Contar registros del nuevo tenant
docker exec orion-menteax_postgres psql -U postgres -d orion_db -c \
  "SELECT 'customers' AS tabla, COUNT(*) FROM customers WHERE tenant_id = 'UUID'
   UNION ALL
   SELECT 'orders', COUNT(*) FROM orders WHERE tenant_id = 'UUID'
   UNION ALL
   SELECT 'products', COUNT(*) FROM products WHERE tenant_id = 'UUID';"
```

### 5. Test de aislamiento (opcional pero recomendado)

```bash
docker cp database/tests/tenant_isolation_test.sql orion-menteax_postgres:/tmp/
docker exec orion-menteax_postgres psql -U postgres -d orion_db \
  -f /tmp/tenant_isolation_test.sql
```

Resultado esperado: 7/7 PASS, 0 FAIL.

---

## Configurar verticales

Las verticales activas se definen durante el onboarding. Para cambiarlas despues:

```sql
-- Activar cross_sell para un tenant
UPDATE tenants
SET active_verticals = '["reposicion", "activacion", "cross_sell"]'::jsonb
WHERE slug = 'SLUG';
```

### Verticales disponibles

| Vertical | Que hace | Requisito minimo |
|----------|----------|------------------|
| `reposicion` | Predice cuando un cliente va a necesitar recomprar | 3+ ordenes del cliente |
| `activacion` | Detecta clientes nuevos que no hicieron segunda compra | 1 sola orden |
| `recuperacion` | Identifica clientes inactivos para recuperar | 60+ dias sin comprar |
| `cross_sell` | Sugiere productos complementarios basado en co-purchases | Materialized view (se refresca semanal) |

---

## Troubleshooting

### Error: "Tenant con slug 'X' no encontrado o inactivo"
- Verificar que el slug es correcto: `SELECT slug, active FROM tenants;`
- Si `active = false`, activar: `UPDATE tenants SET active = true WHERE slug = 'X';`

### Error: "GoTrue API error 422"
- Email ya registrado en GoTrue. El script ofrece continuar con el usuario existente.
- Si el email esta en otro tenant, crear un email diferente.

### Error: "ERP_ENCRYPTION_KEY no configurada"
- La clave Fernet no esta en `.env`. Ejecutar:
  `backend/venv/bin/python backend/scripts/setup_credentials.py --init`

### Error: "test_connection() fallo"
- Verificar credenciales ERP (client_id, client_secret)
- Verificar que la API del ERP esta accesible desde el VPS
- Ver checklist de riesgos en CLAUDE.md (Cloudflare, firewall, etc.)

### El dashboard muestra datos de otro tenant
- **CRITICO:** Verificar que `app_metadata.tenant_id` del usuario es correcto
- Verificar con: `docker exec orion-menteax_postgres psql -U postgres -d orion_db -c
  "SELECT raw_app_meta_data FROM auth.users WHERE email = 'EMAIL';"`
- Si es incorrecto, patchear via GoTrue API o re-ejecutar el script

### El sync diario no corre para el nuevo tenant
- El orquestador (`backend/main.py`) procesa TODOS los tenants activos automaticamente.
- Verificar que el tenant esta activo: `SELECT active FROM tenants WHERE slug = 'SLUG';`
- Verificar logs del orquestador: `tail -50 ~/logs/orchestrator.log`
