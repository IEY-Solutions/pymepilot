# Forgot/Reset Password — Acceptance Criteria

**ID**: `forgot-password`
**Date**: 2026-07-02

---

## Fase 1 — funcional ya

### AC-F1-01: Solicitud de reset exitosa
**Given** un usuario con cuenta en GoTrue (email: `test@example.com`), en la página `/forgot-password`
**When** ingresa `test@example.com` y clickea "Enviar"
**Then**
- Se muestra el mensaje: "Si el email existe en el sistema, recibirás un enlace de recuperación."
- El botón queda disabled durante la llamada y muestra "Enviando..."
- Se llama a `supabase.auth.resetPasswordForEmail()` con `redirectTo` apuntando a `/reset-password`
- GoTrue envía un email al usuario con un link de recuperación

**Fixture que engañaría este test:** dar por válido el test con solo revisar que el mensaje se
muestre, sin verificar que `resetPasswordForEmail()` fue invocado y el email efectivamente se
despachó. Para sobrevivir: el test debe verificar la llamada a la API de Supabase y el delivery
del email (vía logs de GoTrue o inbox de prueba).

---

### AC-F1-02: Solicitud de reset con email inexistente — mensaje genérico
**Given** un email que no existe en GoTrue (`noexiste@example.com`), en la página `/forgot-password`
**When** ingresa ese email y clickea "Enviar"
**Then**
- Se muestra exactamente el mismo mensaje que en AC-F1-01
- El comportamiento UI es idéntico (misma demora, mismo estado del botón)
- NO se revela que el email no existe

---

### AC-F1-03: Solicitud de reset con email vacío
**Given** la página `/forgot-password`
**When** se hace submit sin ingresar email (campo vacío)
**Then**
- Se muestra error de validación client-side: "Ingresá tu email."
- NO se llama a `resetPasswordForEmail()`

---

### AC-F1-04: Reset de contraseña exitoso
**Given** un usuario que clickeó el link de recuperación del email, tiene una sesión temporal
activa, y está en la página `/reset-password`
**When** ingresa `nuevaClave123` en ambos campos y clickea "Cambiar contraseña"
**Then**
- Se llama a `supabase.auth.updateUser({ password: 'nuevaClave123' })`
- Se muestra mensaje de éxito: "Contraseña cambiada con éxito. Redirigiendo..."
- El usuario es redirigido a `/login` en menos de 2 segundos
- El usuario puede hacer login con `nuevaClave123`

---

### AC-F1-05: Reset con contraseñas no coincidentes
**Given** el usuario en `/reset-password` con sesión temporal activa
**When** ingresa `nuevaClave123` en el primer campo y `nuevaClave456` en el segundo
**Then**
- Se muestra error client-side: "Las contraseñas no coinciden."
- NO se llama a `updateUser()`

---

### AC-F1-06: Reset con contraseña demasiado corta
**Given** el usuario en `/reset-password` con sesión temporal activa
**When** ingresa `ab` (2 caracteres) en ambos campos
**Then**
- Se muestra error client-side: "La contraseña debe tener al menos 6 caracteres."
- NO se llama a `updateUser()`

---

### AC-F1-07: Reset con campos vacíos
**Given** el usuario en `/reset-password` con sesión temporal activa
**When** se hace submit con ambos campos vacíos
**Then**
- Se muestra error de validación: "Completá todos los campos."
- NO se llama a `updateUser()`

---

### AC-F1-08: Acceso a `/reset-password` sin sesión (token expirado o acceso directo)
**Given** un usuario que navega directamente a `/reset-password` sin haber pasado por el flujo
de recovery (sin sesión temporal)
**When** la página carga
**Then**
- Se muestra mensaje: "El enlace de recuperación no es válido o expiró."
- Se muestra un link "Solicitar uno nuevo" que navega a `/forgot-password`
- NO se muestra el formulario de nueva contraseña

---

### AC-F1-09: Link en login
**Given** la página `/login`
**When** se renderiza
**Then**
- Existe un link con texto "¿Olvidaste tu contraseña?" debajo del botón "Ingresar"
- Al clickear, navega a `/forgot-password`

---

### AC-F1-10: Middleware permite rutas públicas
**Given** un usuario no autenticado (sin sesión)
**When** navega a `/forgot-password`, `/reset-password`, o `/auth/callback`
**Then**
- La página se renderiza sin ser redirigido a `/login`
- El status HTTP es 200 (no 302/307)

---

### AC-F1-11: Ruta `/auth/callback` funcional
**Given** GoTrue redirige al usuario a `https://app.pymepilot.cloud/auth/callback?code=...`
después de validar el token de recovery
**When** el navegador carga esa URL
**Then**
- `@supabase/ssr` intercambia el `code` por una sesión (vía middleware o route handler)
- El usuario termina en `/reset-password` con sesión temporal activa
- Puede completar el formulario de nueva contraseña

---

### AC-F1-12: No regresión — login normal sigue funcionando
**Given** un usuario con sesión activa (ya logueado antes de los cambios)
**When** cierra sesión y vuelve a `/login`
**Then**
- Puede hacer login con su contraseña actual normalmente
- El flujo de login no fue alterado

---

## Fase 2 — dejarlo bien

### AC-F2-01: Rate limiting en `/forgot-password`
**Given** una IP que ya hizo 3 solicitudes de reset en los últimos 15 minutos
**When** intenta una cuarta solicitud desde la misma IP
**Then**
- Recibe HTTP 429 con body `{"error": "RATE_LIMITED", "message": "Demasiadas solicitudes. Esperá N segundos."}`
- Header `Retry-After` indica los segundos restantes
- NO se envía email a GoTrue

---

### AC-F2-02: Rate limiting respeta la ventana de 15 minutos
**Given** una IP que hizo 3 solicitudes hace 16 minutos
**When** intenta una nueva solicitud
**Then**
- La solicitud se procesa normalmente (HTTP 200)
- Se envía email a GoTrue

---

### AC-F2-03: Anti-enumeración — tiempo de respuesta constante
**Given** dos solicitudes consecutivas a `/forgot-password`, una con email existente y otra
con email inexistente
**When** se mide el tiempo de respuesta de ambas
**Then**
- La diferencia en tiempo de respuesta es menor a 200ms (descartando ruido de red)
- El status code y el body son idénticos

**Fixture que engañaría este test:** medir solo una vez cada caso; el ruido de red puede dar
falsos positivos. Para sobrevivir: repetir 5 veces cada caso, comparar medianas.

---

### AC-F2-04: Audit trail — reset solicitado
**Given** un usuario solicita reset desde `/forgot-password` con email `usuario@tenant.com`
**When** GoTrue procesa la solicitud y el frontend recibe éxito
**Then**
- Se registra un evento `password.reset_requested` con: timestamp, tenant_id derivado del
  email, hash SHA-256 del email, IP del request, user-agent
- El registro es atómico (se escribe aunque GoTrue falle después)

---

### AC-F2-05: Audit trail — reset completado
**Given** un usuario completa el cambio de contraseña en `/reset-password`
**When** `updateUser()` devuelve éxito
**Then**
- Se registra un evento `password.reset_completed` con: timestamp, tenant_id, user_id
  (disponible porque ya hay sesión), IP del request

---

### AC-F2-06: Token expirado — mensaje claro
**Given** un usuario intenta acceder a `/reset-password` con un token que expiró (más de 1 hora)
**When** la página carga (sin sesión temporal)
**Then**
- Se muestra: "El enlace de recuperación expiró. Solicitá uno nuevo."
- Hay un link a `/forgot-password`

---

### AC-F2-07: Token inválido/ya usado — mensaje claro
**Given** un usuario intenta usar un link de recovery que ya fue usado
**When** GoTrue redirige sin establecer sesión (token inválido)
**Then**
- Se muestra: "El enlace no es válido. Solicitá uno nuevo."
- Hay un link a `/forgot-password`
- El mensaje es distinto del de token expirado (más claro para el usuario)

---

### AC-F2-08: Copys en español consistentes
**Given** cualquier página del flujo (`/forgot-password`, `/reset-password`) en cualquier
estado (éxito, error, validación)
**When** se revisan todos los textos visibles
**Then**
- Todo el copy está en español
- Coincide con el tono del resto del dashboard (profesional, cercano, sin tecnicismos)
- Los mensajes de error no contienen texto en inglés ni códigos técnicos (e.g. "Invalid token",
  "auth/expired-token")

---

### AC-F2-09: Loading states visibles
**Given** el usuario hace submit en `/forgot-password` o `/reset-password`
**When** la llamada está en vuelo
**Then**
- El botón de submit muestra un spinner o texto de carga (no queda en blanco)
- El botón está disabled para prevenir doble submit
- Si la llamada falla, el botón se re-habilita con el mensaje de error

---

### AC-F2-10: Mobile rendering
**Given** un viewport de 375px de ancho (iPhone SE)
**When** se renderiza `/forgot-password` y `/reset-password`
**Then**
- Los formularios no se cortan ni requieren scroll horizontal
- Los inputs y botones son tappables (mínimo 44px de altura)
- La estética `glass-dark` es consistente con la página de login actual

---

### AC-F2-11: No regresión — login sigue funcional post-Fase 2
**Given** todos los cambios de Fase 2 desplegados
**When** un usuario intenta hacer login normalmente
**Then**
- Flujo de login sin cambios de comportamiento ni estéticos
- El link "¿Olvidaste tu contraseña?" sigue presente y funcional

---

### AC-F2-12: No regresión — dashboard normal
**Given** un usuario autenticado
**When** navega por el dashboard (`/`, `/pipeline`, `/metricas`, etc.)
**Then**
- Todas las páginas renderizan normalmente
- No hay redirecciones inesperadas a `/forgot-password` o `/reset-password`
- Las APIs del dashboard (`/api/*`) no son afectadas

---

### AC-F2-13: Validación de email en `/forgot-password`
**Given** el campo de email en `/forgot-password`
**When** el usuario ingresa `esto-no-es-un-email`
**Then**
- Se muestra error client-side: "Ingresá un email válido."
- NO se llama a `resetPasswordForEmail()`

---

### AC-F2-14: Sesiones viejas invalidadas post-reset
**Given** un usuario con sesión activa en el dispositivo A, que solicita reset desde el
dispositivo B y completa el cambio de contraseña
**When** el dispositivo A intenta hacer una operación autenticada (ej. cargar `/pipeline`)
**Then**
- El dispositivo A es redirigido a `/login` (su JWT viejo fue invalidado por GoTrue)

**Fixture que engañaría este test:** usar el mismo browser con cookies compartidas entre
pestañas. Para sobrevivir: usar un dispositivo o perfil de browser distinto para la sesión A.

---

## Resumen de cobertura

| ID | Tipo | Fase |
|----|------|------|
| AC-F1-01 | Happy path — solicitud reset | 1 |
| AC-F1-02 | Email inexistente — anti-enum básico | 1 |
| AC-F1-03 | Validación — campo vacío | 1 |
| AC-F1-04 | Happy path — cambio de contraseña | 1 |
| AC-F1-05 | Validación — passwords no coinciden | 1 |
| AC-F1-06 | Validación — password corta | 1 |
| AC-F1-07 | Validación — campos vacíos | 1 |
| AC-F1-08 | Sesión ausente — acceso directo | 1 |
| AC-F1-09 | UI — link en login | 1 |
| AC-F1-10 | Middleware — rutas públicas | 1 |
| AC-F1-11 | Flujo completo — callback + sesión | 1 |
| AC-F1-12 | No regresión — login | 1 |
| AC-F2-01 | Rate limiting — bloqueo | 2 |
| AC-F2-02 | Rate limiting — ventana | 2 |
| AC-F2-03 | Anti-enumeración — timing | 2 |
| AC-F2-04 | Audit — reset solicitado | 2 |
| AC-F2-05 | Audit — reset completado | 2 |
| AC-F2-06 | Token expirado — UX | 2 |
| AC-F2-07 | Token inválido — UX | 2 |
| AC-F2-08 | Copys en español | 2 |
| AC-F2-09 | Loading states | 2 |
| AC-F2-10 | Mobile rendering | 2 |
| AC-F2-11 | No regresión — login | 2 |
| AC-F2-12 | No regresión — dashboard | 2 |
| AC-F2-13 | Validación email | 2 |
| AC-F2-14 | Invalidación de sesiones | 2 |
