# Forgot/Reset Password — Spec

**ID**: `forgot-password`
**Date**: 2026-07-02
**Status**: Draft
**Author**: Product-Analyst

---

## 1. Problema

PymePilot no tiene flujo de recuperación de contraseña. Si un usuario del dashboard pierde u olvida
su contraseña, no puede acceder sin intervención manual del administrador del sistema. Esto rompe
la autonomía del tenant (Pilar 4 — Embedded Signup) y genera fricción operativa innecesaria.

## 2. Usuarios objetivo

- **Vendedores / operadores** del dashboard (`user_profiles.role = 'seller'`): necesitan
  recuperar acceso sin depender de un admin.
- **Admins de tenant** (`user_profiles.role = 'super_admin'`): ídem, pero además son quienes
  actualmente reciben el pedido de reset manual.

## 3. Business rules

| # | Regla |
|---|-------|
| R1 | Solo usuarios con cuenta existente en GoTrue pueden solicitar reset. |
| R2 | El reset se inicia desde una página pública (no autenticada). |
| R3 | El link de reset es de un solo uso, emitido por GoTrue, y tiene expiración (default 1h en GoTrue). |
| R4 | La nueva contraseña debe cumplir el mínimo de GoTrue (6 caracteres por defecto). |
| R5 | Después de un cambio exitoso, la sesión vieja queda inválida (GoTrue lo maneja). |
| R6 | El usuario no debe recibir información que permita enumerar cuentas (ver R11 en Fase 2). |
| R7 | El flujo completo opera dentro del mismo tenant y dominio (`app.pymepilot.cloud`). |

## 4. Invariants

| # | Invariante |
|---|-----------|
| I1 | Ningún endpoint de reset expone si un email existe o no en el sistema (post-Fase 2). |
| I2 | Un token de reset solo puede usarse una vez; GoTrue lo invalida al usarse. |
| I3 | El flujo de reset no modifica datos de tenant, `user_profiles`, ni tablas de negocio. |
| I4 | Todas las rutas del flujo (`/forgot-password`, `/reset-password`, `/auth/callback`) son
     accesibles sin sesión activa. |

## 5. Diseño de solución (dos fases)

### 5.1 Fase 1 — funcional ya

**Objetivo:** que un usuario pueda recuperar su contraseña sin intervención manual, con el
mínimo código y riesgo posible. Se usa el flujo nativo de Supabase GoTrue sin customización.

#### 5.1.1 Páginas nuevas

| Ruta | Qué hace | Quién accede |
|------|---------|-------------|
| `/forgot-password` | Formulario: solo campo email + botón "Enviar". Al submit, invoca `supabase.auth.resetPasswordForEmail()` con `redirectTo: '/auth/callback'`. Muestra confirmación genérica: "Si el email existe en el sistema, recibirás un enlace de recuperación." | Público (sin sesión) |
| `/auth/callback` | Página pública que completa el recovery real de Supabase: acepta `?code=` cuando exista y también el redirect con tokens en fragment (`#access_token`, `#refresh_token`), guarda la sesión temporal y luego redirige a `/reset-password`. El middleware debe dejarla pasar sin requerir autenticación. | Público |
| `/reset-password` | Formulario: campo "Nueva contraseña" + "Confirmar contraseña" + botón "Cambiar contraseña". Valida que coincidan y mínimo 6 caracteres. Al submit, invoca `supabase.auth.updateUser({ password })`. En éxito, redirige a `/login`. En error, muestra mensaje en español. | Requiere sesión temporal de recovery (GoTrue la establece tras `/auth/callback`). |

**Nota sobre `/auth/callback`, `/reset-password` y la sesión:** cuando GoTrue valida el token
del link de recuperación, puede volver a `/auth/callback` con `?code=` o con la sesión en el
fragmento de URL. La página completa ese estado en el cliente, guarda la sesión temporal y deja
al usuario en `/reset-password`. Esa sesión permite llamar a `updateUser()`. Si la sesión expiró
o el token es inválido, el usuario vuelve a `/forgot-password` con un motivo de error.

#### 5.1.2 Cambios en login existente

Agregar un link "¿Olvidaste tu contraseña?" debajo del botón "Ingresar" que navegue a
`/forgot-password`. Sin cambios de layout ni estilos nuevos.

#### 5.1.3 Configuración Supabase (GoTrue) requerida

| Parámetro | Valor requerido | Motivo |
|-----------|----------------|--------|
| `GOTRUE_SITE_URL` | `https://app.pymepilot.cloud` | Base URL para construir links de recovery. Sin esto, GoTrue usa `localhost` o la IP interna y los links no funcionan. |
| `GOTRUE_URI_ALLOW_LIST` | Debe incluir `https://app.pymepilot.cloud` y `https://app.pymepilot.cloud/auth/callback` | GoTrue rechaza redirects a dominios no listeados. |
| `GOTRUE_MAILER_AUTOCONFIRM` | `true` (valor actual, verificar que no se haya cambiado) | Los usuarios ya están creados por admin; no debe pedir confirmación extra. |
| `GOTRUE_MAILER_URLPATHS_RECOVERY` | `/auth/v1/verify` (default de GoTrue, verificar) | Path que GoTrue usa en el link de recovery. Si está mal configurado, los links apuntan a una URL rota. |
| SMTP / email provider | Debe estar configurado y funcional | GoTrue necesita poder enviar emails. Si nunca se usó este feature, puede que el mailer esté caído. Ver `GOTRUE_SMTP_*` o `GOTRUE_EXTERNAL_*` en el docker-compose de Supabase. |

#### 5.1.4 Middleware

El middleware de Next.js debe permitir acceso sin sesión a:
- `/forgot-password`
- `/reset-password`
- `/auth/callback`

Estas rutas deben quedar excluidas de la redirección a `/login` que aplica al resto de páginas
no autenticadas. El patrón exacto (whitelist, matcher config, o early-return en
`updateSession()`) lo define arquitectura. UNVERIFIED: el middleware actual en
`frontend/middleware.ts` no hace auth-redirect para páginas; verificar si esa lógica está en
otro lado (layout, `src/lib/supabase/middleware.ts`, o config de Next.js).

#### 5.1.5 Entregables Fase 1

| # | Entregable | Formato |
|---|-----------|---------|
| E1.1 | Página `/forgot-password` | Componente React (client) en `frontend/src/app/forgot-password/page.tsx` |
| E1.2 | Página `/reset-password` | Componente React (client) en `frontend/src/app/reset-password/page.tsx` |
| E1.3 | Ruta `/auth/callback` con handler de Supabase SSR | `frontend/src/app/auth/callback/route.ts` (si no existe ya) |
| E1.4 | Link "¿Olvidaste tu contraseña?" en login | Modificación de `frontend/src/app/login/page.tsx` |
| E1.5 | Middleware: whitelist de rutas públicas | Modificación del middleware que hace auth-redirect |
| E1.6 | Configuración GoTrue corregida | `GOTRUE_SITE_URL` y `GOTRUE_URI_ALLOW_LIST` en el docker-compose de Supabase |
| E1.7 | Verificación de email provider funcional | Test manual: solicitar reset, verificar que el email llega a la bandeja |

---

### 5.2 Fase 2 — dejarlo bien

**Objetivo:** endurecer el flujo con rate limiting, anti-enumeración, audit trail, UX pulida
y copys en español claros. Sin tocar backend Python ni schema de DB.

#### 5.2.1 Rate limiting

La ruta `/forgot-password` debe tener rate limiting por IP para prevenir abuso. El mecanismo
ya existe en el middleware (`apiRateLimiter` en `frontend/middleware.ts` para rutas `/api/*`).
Se debe extender o crear un rate limiter específico:

- **Límite:** 3 solicitudes por IP en 15 minutos.
- **Excedido:** devolver `429 Too Many Requests` con mensaje en español y header `Retry-After`.
- **Contador:** por IP, no por email (evita bloquear a un tenant entero si un atacante prueba
  emails de un mismo tenant).

UNVERIFIED: el rate limiter actual (`lib/rate-limit`) puede reusarse en un route handler o
server action. Arquitectura debe confirmar si aplica a páginas también o solo APIs.

#### 5.2.2 Anti-enumeración

La Fase 1 ya usa un mensaje genérico ("Si el email existe... recibirás un enlace") que no
revela si la cuenta existe. La Fase 2 refuerza esto:

- **Tiempo de respuesta:** el endpoint debe tomar un tiempo constante (~1 segundo) sin importar
  si el email existe o no, para evitar timing attacks.
- **Sin diferencias en headers, status code, o body** entre email existe y email no existe.
- **Sin mensajes de error que distingan "email no encontrado" de "error del servidor".**

UNVERIFIED: `supabase.auth.resetPasswordForEmail()` podría devolver errores distintos según
GoTrue. Si GoTrue distingue, el frontend debe normalizar la respuesta antes de mostrarla.
Arquitectura debe verificar el comportamiento real contra GoTrue self-hosted.

#### 5.2.3 Audit trail

Registrar eventos de reset sin almacenar información sensible:

| Evento | Dónde | Qué se registra |
|--------|-------|----------------|
| `password.reset_requested` | `api_usage` o tabla `audit_log` | timestamp, tenant_id, email hasheado (SHA-256), IP, user-agent |
| `password.reset_completed` | igual | timestamp, tenant_id, user_id (ya autenticado post-reset), IP |

UNVERIFIED: ¿existe tabla `audit_log`? Si no, se puede extender `api_usage` con un campo
`event_type` o crear una tabla mínima. DB-auditor debe decidir.

#### 5.2.4 UX y copys

- **Mensajes de error en español**, coherentes con el tono del resto del dashboard:
  - "El enlace de recuperación expiró. Solicitá uno nuevo." (token vencido)
  - "El enlace no es válido. Solicitá uno nuevo." (token inválido/ya usado)
  - "Las contraseñas no coinciden." (validación client-side)
  - "La contraseña debe tener al menos 6 caracteres." (validación client-side)
  - "Contraseña cambiada con éxito. Redirigiendo..." (éxito, con redirect automático a `/`)
- **Loading states:** spinner o disabled en botones durante envío.
- **Mobile-first:** los formularios deben renderizar correctamente en mobile (misma
  estética `glass-dark` que el login actual).
- **Link "¿Olvidaste tu contraseña?"** en login mantiene el estilo visual existente.

#### 5.2.5 Correo de recuperación

Verificar que el template de email que GoTrue envía sea claro y en español. GoTrue self-hosted
permite customizar templates vía variables de entorno o archivos de template:

- `GOTRUE_MAILER_TEMPLATES_RECOVERY` — contenido del email de recovery
- `GOTRUE_MAILER_SUBJECTS_RECOVERY` — asunto del email

Si GoTrue no soporta templates en español fácilmente, se evalúa si el esfuerzo de
customización vale la pena en Fase 2 o se difiere.

#### 5.2.6 Entregables Fase 2

| # | Entregable | Formato |
|---|-----------|---------|
| E2.1 | Rate limiting en `/forgot-password` | Route handler / server action con rate limiter |
| E2.2 | Normalización de respuestas GoTrue | Wrapper que unifica mensajes de error sin filtrar info |
| E2.3 | Audit trail de eventos de reset | Extensión de `api_usage` o tabla `audit_log` |
| E2.4 | Copys en español pulidos | Actualización de mensajes en ambas páginas |
| E2.5 | Manejo de token expirado/inválido | Página `/reset-password` detecta sesión ausente y muestra error claro |
| E2.6 | Validación client-side de contraseña | Mínimo 6 caracteres + coincidencia de campos |
| E2.7 | Revisión de email template GoTrue | Configuración de templates de recovery en español si es viable |

---

## 6. Dependencias externas

| Dependencia | Dueño | Acción requerida |
|-------------|-------|-----------------|
| Configuración GoTrue (`GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`) | Admin del VPS / Docker | Modificar `docker-compose.yml` de Supabase en `/opt/orion-stack/` y reiniciar el contenedor `auth` |
| Email provider (SMTP) en GoTrue | Admin del VPS | Verificar que `GOTRUE_SMTP_*` esté configurado, funcione, y el puerto esté accesible desde el contenedor `auth` |
| DNS / Traefik | Admin del VPS | Confirmar que `app.pymepilot.cloud` resuelve correctamente y Traefik enruta las rutas nuevas. Las rutas `/forgot-password`, `/reset-password`, `/auth/callback` son subpaths del mismo dominio — no requieren cambios de DNS, pero Traefik debe pasar el tráfico al frontend |
| Supabase SSR (`@supabase/ssr`) | Ya instalado en `frontend/` | Paquete existente en versión que soporta manejo de `auth/callback` y `getSession()` para recovery flow |

## 7. Fuera de alcance

| Ítem | Motivo |
|------|--------|
| Cambios en backend Python (`backend/engine/`) | El flujo es 100% frontend + GoTrue. No tocar Python. |
| Cambios en schema de DB (tablas, migraciones, RLS) | No se necesita nueva tabla para el MVP. Si Fase 2 requiere `audit_log`, es una tabla nueva mínima, sin impacto en datos de tenant. |
| MFA / 2FA | No es parte de este spec. |
| Cambio de contraseña desde el dashboard (usuario ya logueado) | Fuera de scope; este spec cubre solo el flujo "olvidé mi contraseña". |
| Customización visual profunda del email de recovery | Fase 2 evalúa si es viable; si GoTrue self-hosted lo limita, se difiere a una fase 3. |
| Sign-up / registro de nuevos usuarios | Fuera de scope. Los usuarios son creados por admin vía `create_tenant.py`. |
| Integración con WhatsApp o notificaciones in-app para reset | El canal único es email, vía GoTrue. |
| Admin reset (un admin resetea la contraseña de otro usuario) | Fuera de scope. Solo auto-servicio. |

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|------------|---------|-----------|
| GoTrue mailer no funciona (SMTP mal configurado, puerto bloqueado) | Media | Alto — el flujo entero falla | Verificar antes de desarrollar. Si no funciona, usar un servicio externo (Resend, SendGrid) como relay. El costo es marginal (~100 emails/mes gratis). |
| Self-hosted GoTrue tiene comportamiento distinto al cloud para recovery flow | Media | Medio | Probar el flujo completo en staging antes de deployar a prod. |
| Middleware actual no aplica auth-redirect y el acceso ya es público por defecto | Alta | Bajo — simplifica la implementación | Verificar antes de codear. Si no hay auth gate en páginas, solo necesitamos asegurarnos de que `/reset-password` tenga acceso post-recovery. |
| `GOTRUE_MAILER_AUTOCONFIRM=false` causaría que GoTrue pida confirmación de email antes de entregar el token de recovery | Baja | Alto — rompe el flujo para usuarios existentes | Verificar el valor actual antes de tocar nada. |

---

## 9. Spec Audit (self-review)

### Detection/absence requirements
- **R1 (cuenta existente):** el universo es `auth.users` de GoTrue, escaneado por GoTrue
  internamente al recibir `resetPasswordForEmail()`. Si el email no existe, GoTrue devuelve
  éxito de todas formas (anti-enumeración). El spec pide que el frontend muestre siempre el
  mismo mensaje. VERIFICADO: la señal la da GoTrue; el frontend solo actúa como pasamanos.
- **Token expirado (R3):** el universo es la sesión temporal de GoTrue. Si el token expiró,
  GoTrue no establece sesión. El `/reset-password` debe detectar ausencia de sesión y mostrar
  error. VERIFICADO: el data source es `supabase.auth.getSession()` en el cliente.

### Pairwise conflict pass
- **R1 vs R6 (cuenta existente vs anti-enumeración):** R1 dice "solo usuarios con cuenta
  pueden solicitar reset", R6 dice "no revelar si la cuenta existe". No conflictúan: GoTrue
  acepta la solicitud para cualquier email y envía el correo solo si la cuenta existe, pero
  siempre devuelve éxito al frontend. Precedencia: R6 domina sobre R1 en la capa de frontend.
- **R5 vs flujo `/reset-password`:** R5 dice que la sesión vieja se invalida al cambiar
  contraseña. Esto lo maneja GoTrue automáticamente. No hay conflicto.
- **I4 vs auth-redirect del middleware:** si el middleware redirige a `/login` para rutas no
  autenticadas, debe excluir explícitamente `/forgot-password`, `/auth/callback` y
  `/reset-password`. Si no hay auth-redirect actual, I4 se cumple por defecto. VERIFICADO:
  pendiente confirmar si existe auth-redirect en el middleware actual. Marcado UNVERIFIED.

### UNVERIFIED assumptions (must be confirmed by architecture)
1. El middleware actual (`frontend/middleware.ts`) no hace auth-redirect para páginas. Si lo
   hace en otro archivo, ese archivo debe modificarse.
2. `supabase.auth.resetPasswordForEmail()` de `@supabase/ssr` funciona idéntico en self-hosted
   vs cloud (misma API, mismo comportamiento del lado cliente).
3. `resetPasswordForEmail()` usa `redirectTo: '/auth/callback'` y GoTrue self-hosted lo respeta.
4. La ruta `/auth/callback` es manejada automáticamente por `@supabase/ssr` o requiere un
   `route.ts` explícito.
5. El email provider de GoTrue está configurado y funcional.
6. El rate limiter `apiRateLimiter` existente puede reusarse para la ruta de página (no API)
   `/forgot-password`.
7. Existe o debe crearse una tabla `audit_log` o mecanismo equivalente para Fase 2.

---

## 10. Resumen de 5 líneas

- **Scope:** flujo completo de forgot/reset password vía Supabase GoTrue auto-servicio, sin
  intervención manual, en dos fases: funcional ya + endurecido después.
- **Invariantes clave:** no exponer si un email existe, no tocar datos de tenant ni backend
  Python, rutas públicas sin sesión.
- **Dependencia crítica:** configuración de `GOTRUE_SITE_URL` y `GOTRUE_URI_ALLOW_LIST` +
  email provider funcional en GoTrue self-hosted.
- **Primer task (Fase 1):** verificar y corregir la configuración GoTrue antes de escribir
  cualquier código de frontend.
- **Fuera de scope:** MFA, cambio de contraseña desde el dashboard, registro de usuarios,
  notificaciones por WhatsApp, admin reset.
