# Forgot/Reset Password — Tasks

**ID**: `forgot-password`
**Date**: 2026-07-02

---

## Fase 1 — funcional ya

### Bloque 0: Verificación de dependencias (NO empezar código sin esto)

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-000 | Verificar y corregir `GOTRUE_SITE_URL` en docker-compose de Supabase (`/opt/orion-stack/`). Debe ser `https://app.pymepilot.cloud`. | Manual: solicitar reset y verificar que el link en el email apunta a `app.pymepilot.cloud`, no a `localhost`. | Architect + DB-auditor |
| T-001 | Verificar y corregir `GOTRUE_URI_ALLOW_LIST`. Debe incluir `https://app.pymepilot.cloud` y `https://app.pymepilot.cloud/auth/callback`. | Manual: GoTrue no rechaza el redirect. | Architect |
| T-002 | Verificar que GoTrue tiene un email provider configurado y funcional (`GOTRUE_SMTP_*` o `GOTRUE_EXTERNAL_*`). Enviar un email de prueba. | Manual: email de prueba llega a una bandeja real. | Architect |
| T-003 | Verificar `GOTRUE_MAILER_AUTOCONFIRM=true` (o el valor actual no rompe el flujo). | Manual: usuarios existentes pueden solicitar reset sin confirmación extra. | DB-auditor |
| T-004 | Confirmar que `@supabase/ssr` en el frontend soporta `resetPasswordForEmail()` con `redirectTo` en self-hosted. | Revisión de versión del paquete y docs. | Architect |

### Bloque 1: Middleware

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-101 | Identificar dónde se hace auth-redirect para páginas no autenticadas (middleware, layout, o ambos). Si no existe, documentar. | AC-F1-10 | Architect |
| T-102 | Agregar whitelist para `/forgot-password`, `/reset-password`, `/auth/callback` en el mecanismo de auth-redirect. | AC-F1-10, AC-F1-11 | Architect + Security-auditor |
| T-103 | Asegurar que `/auth/callback` es manejado por `@supabase/ssr` (middleware o route handler). Si no existe `route.ts`, crearlo. | AC-F1-11 | Architect |

### Bloque 2: Página `/forgot-password`

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-201 | Crear `frontend/src/app/forgot-password/page.tsx`: formulario con campo email + botón "Enviar". | AC-F1-01, AC-F1-03 | Architect |
| T-202 | Implementar lógica de submit: validar email no vacío, llamar a `supabase.auth.resetPasswordForEmail()` con `redirectTo` derivado de `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL` + `/auth/callback`, mostrar mensaje genérico de éxito. | AC-F1-01, AC-F1-02 | Architect |
| T-203 | Agregar estado de carga (botón disabled + texto "Enviando...") durante la llamada. | AC-F1-09 (loading, Fase 2 parcial) | Architect |
| T-204 | Estilizar con `glass-dark` consistente con login (misma paleta, mismos componentes de input/botón). | AC-F2-10 | Frontend-engineer |

### Bloque 3: Página `/reset-password`

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-301 | Crear `frontend/src/app/reset-password/page.tsx`: formulario con campos de nueva contraseña + confirmar + botón "Cambiar contraseña". | AC-F1-04 | Architect |
| T-302 | Al montar, verificar si hay sesión activa (`supabase.auth.getSession()`). Si no hay, mostrar mensaje de error con link a `/forgot-password`. | AC-F1-08 | Architect |
| T-303 | Implementar lógica de submit: validar coincidencia + mínimo 6 caracteres, llamar a `supabase.auth.updateUser({ password })`, redirigir a `/` en éxito. | AC-F1-04, AC-F1-05, AC-F1-06, AC-F1-07 | Architect |
| T-304 | Manejar errores de `updateUser()`: mostrar mensaje genérico en español sin exponer detalles de GoTrue. | AC-F1-08 | Architect |
| T-305 | Estilizar con `glass-dark` consistente con login. | AC-F2-10 | Frontend-engineer |

### Bloque 4: Cambios en login

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-401 | Agregar link "¿Olvidaste tu contraseña?" debajo del botón "Ingresar" en `frontend/src/app/login/page.tsx`. | AC-F1-09 | Frontend-engineer |

### Bloque 5: Verificación end-to-end

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-501 | Test manual del flujo completo: solicitar reset → recibir email → clickear link → cambiar contraseña → hacer login con nueva contraseña. | AC-F1-01 hasta AC-F1-12 | Architect |
| T-502 | Verificar no regresión: login normal, dashboard, navegación. | AC-F1-12 | Architect |

---

## Fase 2 — dejarlo bien

### Bloque 6: Rate limiting

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-601 | Implementar rate limiting en `/forgot-password`: 3 requests por IP en 15 minutos. Reusar `apiRateLimiter` existente o crear un rate limiter para la ruta de página. | AC-F2-01, AC-F2-02 | Security-auditor |
| T-602 | Devolver 429 con mensaje en español y header `Retry-After` cuando se excede el límite. | AC-F2-01 | Security-auditor |

### Bloque 7: Anti-enumeración

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-701 | Verificar que `supabase.auth.resetPasswordForEmail()` en GoTrue self-hosted devuelve la misma respuesta para email existente e inexistente. Si no, normalizar la respuesta en el frontend. | AC-F2-03 | Security-auditor |
| T-702 | Agregar un delay artificial (~800ms) si GoTrue responde más rápido para email inexistente que para existente, para normalizar timing. | AC-F2-03 | Performance-auditor (no debe degradar UX) |

### Bloque 8: Audit trail

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-801 | Diseñar mecanismo de audit: ¿tabla nueva `audit_log` o extensión de `api_usage`? Decidir con DB-auditor. | — | DB-auditor |
| T-802 | Implementar registro de evento `password.reset_requested` (email hasheado, timestamp, IP, tenant_id). | AC-F2-04 | DB-auditor + Security-auditor |
| T-803 | Implementar registro de evento `password.reset_completed` (user_id, timestamp, IP, tenant_id). | AC-F2-05 | DB-auditor + Security-auditor |

### Bloque 9: UX y copys

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-901 | Revisar y pulir todos los mensajes de usuario: éxito, error, validación, token expirado, token inválido. Asegurar español consistente. | AC-F2-06, AC-F2-07, AC-F2-08 | Frontend-engineer |
| T-902 | Mejorar loading states: spinner en botones, disabled durante llamada, mensaje de feedback claro. | AC-F2-09 | Frontend-engineer |
| T-903 | Verificar mobile rendering en viewports comunes (375px, 414px, 768px). | AC-F2-10 | Frontend-engineer |
| T-904 | Agregar validación client-side de formato de email en `/forgot-password`. | AC-F2-13 | Frontend-engineer |

### Bloque 10: Email template (opcional, evaluar viabilidad)

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-1001 | Investigar si GoTrue self-hosted soporta templates de email customizables (variables `GOTRUE_MAILER_TEMPLATES_RECOVERY`, `GOTRUE_MAILER_SUBJECTS_RECOVERY`). | — | Architect |
| T-1002 | Si es viable, crear template de recovery en español con branding PymePilot mínimo. Si no es viable, documentar la limitación y diferir. | — | Architect |

### Bloque 11: Verificación end-to-end Fase 2

| Task | Descripción | Accept. | Gate |
|------|------------|---------|------|
| T-1101 | Verificar rate limiting: 4 requests desde misma IP → 429 en la 4ta. | AC-F2-01, AC-F2-02 | Security-auditor |
| T-1102 | Verificar anti-enumeración: timing test con 5 repeticiones para email válido e inválido. | AC-F2-03 | Security-auditor |
| T-1103 | Verificar audit trail: eventos registrados en DB para solicitud y completado. | AC-F2-04, AC-F2-05 | DB-auditor |
| T-1104 | Verificar invalidación de sesiones: login en dispositivo A, reset desde B, A redirigido a login. | AC-F2-14 | Security-auditor |
| T-1105 | Verificar no regresión completa: login, dashboard, APIs, navegación. | AC-F2-11, AC-F2-12 | Architect |

---

## Orden de ejecución

```
T-000 → T-001 → T-002 → T-003 → T-004   (bloque 0, paralelizable)
    ↓
T-101 → T-102 → T-103                     (bloque 1)
    ↓
T-201 → T-202 → T-203 → T-204             (bloque 2, puede empezar después de T-102)
T-301 → T-302 → T-303 → T-304 → T-305     (bloque 3, puede empezar después de T-103)
T-401                                      (bloque 4, independiente)
    ↓
T-501 → T-502                              (bloque 5, verificación Fase 1)
    ↓
--- FASE 1 COMPLETA ---
    ↓
T-601 → T-602                              (bloque 6)
T-701 → T-702                              (bloque 7)
T-801 → T-802 → T-803                      (bloque 8, después de T-801 que requiere DB-auditor)
T-901 → T-902 → T-903 → T-904              (bloque 9, independiente)
T-1001 → T-1002                            (bloque 10, opcional)
    ↓
T-1101 → T-1102 → T-1103 → T-1104 → T-1105 (bloque 11, verificación Fase 2)
```
