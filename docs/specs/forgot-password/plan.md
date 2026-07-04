# Forgot/Reset Password — Plan

**ID**: `forgot-password`
**Date**: 2026-07-02

---

## Secuencia y dependencias

### Pre-condición crítica (antes de cualquier código)

La configuración de GoTrue es el blocker principal. Sin `GOTRUE_SITE_URL` correcto, los links
de recuperación apuntan a `localhost` o a la IP interna del contenedor y son inútiles. Sin
email provider funcional, GoTrue no puede enviar correos. **Estos dos ítems deben verificarse
y corregirse antes de escribir una sola línea de frontend.**

```
Config GoTrue corrigida ──► Middleware whitelist ──► Páginas ──► Link en login ──► Verificación
```

### Fase 1: ~3-5 horas de trabajo

| Paso | Qué | Quién | Output |
|------|-----|-------|--------|
| 0 | Verificar/corregir GoTrue config | Admin VPS / DevOps | GoTrue funcional con emails enviándose |
| 1 | Identificar auth-redirect actual y whitelistear rutas | Implementer | Middleware actualizado |
| 2 | Crear `/forgot-password` | Implementer | Página funcional |
| 3 | Crear `/reset-password` | Implementer | Página funcional |
| 4 | Crear `/auth/callback` (si no existe) | Implementer | Route handler |
| 5 | Agregar link en login | Implementer | Login actualizado |
| 6 | Test end-to-end manual | Implementer + Tester | Flujo completo andando |

### Fase 2: ~4-6 horas de trabajo

| Paso | Qué | Quién | Output |
|------|-----|-------|--------|
| 7 | Rate limiting | Implementer | `/forgot-password` con rate limit |
| 8 | Anti-enumeración (normalización + timing) | Implementer | Respuestas indistinguibles |
| 9 | Audit trail | Implementer + DB-auditor | Eventos registrados |
| 10 | UX pulido (copys, loading, mobile, validación email) | Implementer | UI completa |
| 11 | Email template (opcional) | Implementer | Templates en español o doc de limitación |
| 12 | Verificación end-to-end completa | Implementer + Security-auditor | Spec verificado |

---

## Puntos de decisión humana

### D1: Después del Bloque 0 (T-000 a T-004)
Si GoTrue no tiene email provider configurado o el SMTP no funciona, **el proyecto se bloquea**
hasta que se resuelva. Opciones:
- A) Configurar SMTP en GoTrue (requiere credenciales de un servicio de email).
- B) Usar un servicio externo como relay (Resend, SendGrid) con su API key en GoTrue.
- C) Usar Supabase cloud solo para auth (cambia la arquitectura actual).

**Decisión requerida:** elegir provider de email y proveer credenciales.

### D2: Después de T-102 (middleware)
Si el middleware actual no hace auth-redirect para páginas (solo para APIs), confirmar que
realmente no hay un gate de auth en otro lado (layout, `src/lib/supabase/middleware.ts`, o
config de Next.js). Si todo es público por defecto, T-102 y T-103 se simplifican a "no hacer
nada" — pero debe documentarse.

### D3: Después de T-801 (diseño de audit trail)
El DB-auditor debe decidir si se crea una tabla nueva `audit_log` o se extiende `api_usage`.
Si se crea tabla nueva:
- ¿Necesita RLS? No, si los eventos son del sistema (no del tenant). O sí, si el tenant debe
  poder ver sus propios eventos de reset.
- ¿Requiere migración? Sí.

**Decisión requerida:** aprobar diseño de tabla o extensión.

### D4: Después de T-1001 (viabilidad de email template)
Si GoTrue self-hosted no soporta templates customizables fácilmente (requiere modificar
archivos dentro del contenedor, o la versión actual no lo soporta), documentar la limitación
y diferir el template customizado a Fase 3.

---

## Riesgos y mitigaciones

| Riesgo | Fase | Mitigación |
|--------|------|-----------|
| GoTrue mailer no funciona | 1 | Verificar ANTES de codear. Si no funciona, evaluar relay externo (Resend free tier: 100 emails/día). |
| `@supabase/ssr` no maneja `auth/callback` en self-hosted igual que en cloud | 1 | Leer docs actuales de `@supabase/ssr` para la versión instalada. Probar en staging. |
| El middleware actual no existe como archivo separado; el auth-redirect está en un layout | 1 | Rastrear la lógica de auth-redirect real antes de asumir que está en middleware. |
| GoTrue devuelve error distinguible para email existente vs inexistente | 2 | Envolver la respuesta en el frontend para normalizar. Si GoTrue es el que distingue, no podemos controlarlo del lado frontend — requiere config de GoTrue (`GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED`) o aceptar la limitación. |
| Rate limiting en página (no API) requiere un approach distinto | 2 | El rate limiter actual está en middleware y aplica a `/api/*`. Para una página, usar un route handler (API route) que reciba el POST del formulario en vez de llamar a GoTrue directo desde el cliente. Esto agrega complejidad — evaluar tradeoff. |

---

## Qué no hacer

- No tocar `backend/engine/` ni scripts Python.
- No modificar schema `public` de DB (solo agregar `audit_log` si se aprueba en D3).
- No cambiar el flujo de login existente (solo agregar el link).
- No implementar sign-up, MFA, ni cambio de contraseña desde el dashboard.
- No tocar RLS policies existentes.
- No desplegar sin verificar el flujo completo en staging/producción con un email real.
