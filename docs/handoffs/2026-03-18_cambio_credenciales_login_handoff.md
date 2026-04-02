# Handoff — Sesion 2026-03-18: Cambio de credenciales de acceso

## Resumen de sesion

Objetivo: reemplazar el usuario/password de test usados para entrar a PymePilot
por credenciales reales, sin perder acceso ni mezclar tenants.

No se hicieron cambios de codigo ni de infraestructura. La sesion fue de
analisis operativo y definicion del camino seguro.

## Hallazgos verificados

1. El frontend no guarda usuarios ni passwords.
   - La pantalla de login usa `supabase.auth.signInWithPassword(...)`.
   - Archivo revisado: `frontend/src/app/login/page.tsx`

2. El usuario real del dashboard vive en Supabase Auth / GoTrue.
   - El onboarding actual crea el usuario admin en GoTrue con
     `app_metadata.tenant_id`.
   - Archivo revisado: `backend/scripts/create_tenant.py`
   - Doc revisada: `docs/ONBOARDING.md`

3. El camino mas seguro hoy NO es editar el usuario "en el lugar".
   - Opcion recomendada: crear un usuario admin nuevo con email real sobre el
     tenant existente, probar login, y recien despues retirar el usuario de test.
   - Razon: minimiza riesgo de lockout.

4. Re-ejecutar `create_tenant.py` con el MISMO email existente NO cambia la
   password.
   - En el branch `already_exists`, el script busca el usuario y solo hace
     `PUT /admin/users/{id}` para asegurar `app_metadata.tenant_id`.
   - No actualiza password en ese path.
   - Implicacion: si se sigue la opcion segura con onboarding, debe usarse un
     email real NUEVO, no el email del usuario de test.

5. Crear un tenant nuevo con datos inventados es incorrecto para este caso.
   - Un tenant representa una empresa completa, no un usuario.
   - Si se crea un tenant nuevo, el login entra a otro espacio separado por
     `tenant_id`, probablemente vacio.

## Estado al cerrar la sesion

- Pato habia empezado `create_tenant.py` con datos nuevos, pero se le indico
  frenarlo para no crear una empresa incorrecta.
- La tarea correcta para retomar manana es identificar primero el tenant real
  existente (`name`, `slug`, `erp_type`) y recien despues crear el usuario real
  sobre ese tenant.

## Consultas seguras preparadas para la proxima sesion

Primera consulta recomendada:

```bash
docker exec orion-menteax_postgres psql -U postgres -d orion_db -c "
SELECT id, name, slug, erp_type, active
FROM tenants
ORDER BY created_at DESC;"
```

Si la salida deja dudas, segunda consulta:

```bash
docker exec orion-menteax_postgres psql -U postgres -d orion_db -c "
SELECT
  t.id,
  t.name,
  t.slug,
  t.erp_type,
  t.active,
  COUNT(DISTINCT up.id) AS users,
  COUNT(DISTINCT c.id) AS customers,
  COUNT(DISTINCT o.id) AS orders
FROM tenants t
LEFT JOIN user_profiles up ON up.tenant_id = t.id
LEFT JOIN customers c ON c.tenant_id = t.id
LEFT JOIN orders o ON o.tenant_id = t.id
GROUP BY t.id, t.name, t.slug, t.erp_type, t.active
ORDER BY customers DESC, orders DESC, users DESC;"
```

## Plan exacto para manana

1. Identificar el tenant real con las consultas anteriores.
2. Anotar `name`, `slug` y `erp_type` exactos.
3. Re-ejecutar `backend/scripts/create_tenant.py`.
4. Ingresar los datos REALES del tenant existente.
5. Cuando el script diga que el tenant ya existe, responder `s`.
6. En el paso de usuario admin, usar un email real NUEVO y password real.
7. Si no hay que tocar ERP, dejar `Client ID` vacio para saltear ese paso.
8. Probar login nuevo en ventana incognito.
9. Solo cuando el login nuevo funcione, planificar retiro del usuario de test.

## Riesgos / decisiones pendientes

1. Falta definir si el estado final deseado es:
   - un usuario nuevo con email real y baja del usuario de test, o
   - actualizar el usuario existente en el lugar via Admin API.

2. Si Pato quiere conservar exactamente el MISMO email del usuario actual y
   solo cambiar la password, entonces ya no alcanza con el onboarding actual;
   habra que usar una actualizacion admin puntual en GoTrue.

3. Al retirar el usuario de test, recordar que una sesion JWT ya emitida puede
   seguir valida hasta expirar. Tenerlo en cuenta para no asumir revocacion
   instantanea.

## Archivos y docs revisados en esta sesion

- `docs/PROJECT_STATE.md`
- `frontend/src/app/login/page.tsx`
- `docs/ONBOARDING.md`
- `backend/scripts/create_tenant.py`
- `database/migrations/016_consolidate_to_orion_db.sql`

## Estado del repo al cerrar

Base actual revisada: commit `b3e7cfc`.

Habia cambios previos NO relacionados que no se tocaron ni se deben revertir:

- `.codex/config.toml`
- `.codex/config.toml`
- `docs/AUDIT-PRE-PRODUCTION-20260314.md`
- `starter-kit.tar.gz`
- `starter-kit/`

El commit de esta sesion debe incluir solo documentacion de handoff.

## Prompt sugerido para abrir la sesion de manana

```text
Lee primero AGENTS.md y docs/PROJECT_STATE.md completos. Despues lee
docs/handoffs/2026-03-18_cambio_credenciales_login_handoff.md.

Estamos retomando el trabajo de reemplazar las credenciales de test de
PymePilot por credenciales reales sin crear un tenant nuevo por error.

Contexto clave ya verificado:
- El login usa Supabase Auth / GoTrue
- El onboarding create_tenant.py crea usuarios admin con app_metadata.tenant_id
- La opcion mas segura es crear un usuario admin NUEVO sobre el tenant
  existente, probar login, y despues retirar el usuario de test
- NO hay que crear un tenant nuevo con datos inventados
- Re-ejecutar create_tenant.py con el mismo email existente NO cambia password;
  en ese caso solo actualiza app_metadata

Objetivo de esta sesion:
1. Encontrar el tenant real existente con consultas SQL seguras
2. Confirmar name, slug y erp_type correctos
3. Guiar el re-run de create_tenant.py sobre ese tenant
4. Crear el usuario real con un email nuevo
5. Verificar login
6. Preparar el retiro seguro del usuario de test

No leer .env. No usar SELECT *. No crear un tenant nuevo. Explica cada paso en
modo educativo antes de ejecutarlo.
```
