# Análisis: De MVP a SaaS — Lo que falta

**Fecha:** 2026-03-04
**Estado:** Documento de referencia (no es un plan de ejecución)
**Contexto:** MVP completado en 13 días (Fases 0-9). 1 tenant activo (IEY).

---

## Decisiones de producto (definidas por Pato)

| Decisión | Respuesta |
|----------|-----------|
| Target | Distribuidores B2B chicos y medianos |
| Pricing | Suscripción mensual fija |
| ERPs al lanzamiento | Contabilium + Excel + 2 más (Colppy, Xubio) |
| Mercado | LATAM (MercadoPago + Stripe) |

---

## Lo que ya existe (MVP)

- Multi-tenant con RLS auditado (34 migraciones, 6 rondas 0C/0H)
- 4 verticales operativas (reposición, activación, recuperación, cross-sell)
- Dashboard en app.pymepilot.cloud (métricas, contactar, historial, datos)
- Sync ERP (Contabilium API + Excel + Smart File Upload + Google Drive)
- Motor Python con Claude API + 4 capas de control de costos
- Monitoreo Grafana (operaciones + costos)
- Orquestador diario 5 AM con flock
- Botón WhatsApp wa.me para contactar clientes
- Exports Excel 4 hojas + PDF resumen ejecutivo
- Script create_tenant.py + ONBOARDING.md

---

## Las 8 capas faltantes

### CAPA 1 — Autenticación y Onboarding Self-Service

**Hoy:** Pato corre create_tenant.py manualmente. El login existe pero
se configura a mano.

**Falta:**
- Landing page pública (qué es PymePilot, pricing, CTA de registro)
- Signup flow (email + password → crea tenant automático → asigna plan trial)
- Onboarding wizard:
  - Paso 1: datos de la empresa
  - Paso 2: conectar ERP o subir Excel
  - Paso 3: esperar primera sync
  - Paso 4: ver dashboard
- Email de verificación (GoTrue ya lo soporta, falta configurar SMTP)
- Recuperar contraseña (GoTrue lo tiene, falta frontend)
- Roles dentro del tenant:
  - Admin: configura ERP, ve métricas, gestiona usuarios
  - Vendedor: ve solo sus clientes y predicciones
- Asignación de clientes por vendedor (para distribuidor mediano con 3-10 vendedores)

**Dependencias:** SMTP server, diseño UI de onboarding

---

### CAPA 2 — Billing y Suscripciones

**Hoy:** Gratis. Sin forma de cobrar.

**Falta:**
- Definición de planes:
  - Starter (~$29/mes): hasta 100 clientes, 2 verticales
  - Pro (~$79/mes): ilimitado, 4 verticales, exports
  - Enterprise: custom
- Integración MercadoPago (Argentina, suscripciones recurrentes)
- Integración Stripe (resto de LATAM)
- Tabla `subscriptions` (tenant_id, plan, status, fecha inicio/fin, payment_provider)
- Middleware de enforcement (plan vencido → bloquear features, NO borrar datos)
- Página de billing (plan actual, cambiar plan, facturas, medio de pago)
- Webhooks de pago (MercadoPago/Stripe notifican → actualizar status)
- Trial period (ej: 14 días gratis con plan Pro)
- Facturación (Argentina: factura A/B, integrar con servicio de facturación)

**Dependencias:** Cuenta en MercadoPago y Stripe, definición final de planes y precios

---

### CAPA 3 — Conectores ERP adicionales

**Hoy:** Contabilium API + Excel/CSV + Smart File Upload (Claude parsea).

**Falta:**
- Conector Colppy (investigar API, implementar ColppyConnector extends ERPConnector ABC)
- Conector Xubio (idem)
- Selector de ERP en onboarding ("¿Qué sistema usás?" → pasos específicos)
- OAuth flow para cada ERP (si soportan OAuth en vez de API key manual)
- Testing de cada conector con datos reales de al menos 1 distribuidor
- Rate limiting por ERP (cada API tiene sus propios límites)

**Dependencias:** Acceso a APIs de Colppy y Xubio, distribuidor de prueba por cada ERP

---

### CAPA 4 — Infraestructura de Producción

**Hoy:** 1 VPS Contabo, sin redundancia, sin CDN, deploy manual.

**Falta:**
- CDN para frontend (Vercel o Cloudflare Pages para Next.js)
- Base de datos gestionada (Supabase Cloud o RDS en vez de Docker self-hosted)
  - Backups automáticos, réplicas, escalado
- Segundo servidor o failover (si el VPS se cae, todo se cae)
- CI/CD pipeline (push a main → tests → build → deploy automático)
- Dominio y SSL gestionado (pymepilot.com con certificado automático)
- Separar ambientes (dev, staging, producción — hoy todo es producción)
- Logs centralizados (con N tenants: Loki, Datadog, o similar)
- Backups offsite (hoy los backups están en el mismo VPS)

**Dependencias:** Decisión de proveedor cloud, presupuesto de infraestructura

---

### CAPA 5 — Alertas y Monitoreo Proactivo

**Hoy:** Grafana con dashboards visuales. Hay que abrir Grafana para ver
si algo falló.

**Falta:**
- Alertas por email (configurar SMTP en Grafana, alertar cuando orquestador falla)
- Alertas por WhatsApp (notificar si algo crítico falla)
- Health check endpoint (/api/health que verifique DB, sync, último run)
- Uptime monitoring externo (UptimeRobot, Better Uptime)
- Alertas de billing (pago fallido, trial venciendo)

**Dependencias:** SMTP server, servicio de uptime monitoring

---

### CAPA 6 — Tests Automatizados

**Hoy:** Auditorías manuales con 3 agentes. 6 rondas, todas 0C/0H. Pero
son manuales.

**Falta:**
- Tests unitarios Python (pytest para verticales, conectores, claude client)
- Tests de integración SQL (verificar RPCs retornan lo esperado)
- Tests de aislamiento tenant (automatizar los 12 tests manuales)
- Tests E2E frontend (Playwright o Cypress para happy path)
- Tests en CI (corran en cada push, bloqueen merge si fallan)

**Dependencias:** CI/CD pipeline (Capa 4)

---

### CAPA 7 — UX y Features de Producto

**Hoy:** Dashboard funcional pero básico. Sin onboarding guiado, sin
ayuda contextual.

**Falta:**
- Onboarding guiado (tooltips de primera vez)
- Notificaciones in-app (badge con predicciones nuevas)
- Configuración de verticales desde dashboard (hoy se hace en DB)
- Configuración de prompts por tenant (personalizar tono/contenido)
- Multi-idioma (portugués para Brasil mínimo si el mercado es LATAM)
- Página de settings (datos empresa, gestionar usuarios, API keys)

**Dependencias:** Capa 1 (roles y onboarding), diseño UX

---

### CAPA 8 — Legal y Compliance

**Hoy:** Nada.

**Falta:**
- Términos y condiciones (contrato de servicio)
- Política de privacidad (GDPR / ley argentina de datos personales 25.326)
- DPA — Data Processing Agreement (para clientes que manejan datos de sus clientes)
- Política de cookies (si se usan analytics)
- SLA documentado (uptime garantizado, qué pasa si se cae)

**Dependencias:** Asesoría legal

---

## Orden sugerido de implementación

Si se decide avanzar, el orden recomendado por dependencias:

```
Fase 10: Mejoras IEY (ya planificada — prompts, atribución, WhatsApp)
    ↓
Capa 5: Alertas (bajo esfuerzo, alto impacto para dormir tranquilo)
    ↓
Capa 6: Tests automatizados (base para todo lo que sigue)
    ↓
Capa 4: Infraestructura (CI/CD, ambientes, backups offsite)
    ↓
Capa 1: Onboarding self-service (habilita crecer sin intervención)
    ↓
Capa 3: Conectores ERP (amplía mercado)
    ↓
Capa 2: Billing (habilita cobrar)
    ↓
Capa 7: UX avanzada (retención y satisfacción)
    ↓
Capa 8: Legal (antes del lanzamiento público)
```

**Nota:** Este orden puede cambiar según oportunidades de negocio.
Si aparece un cliente que usa Colppy, Capa 3 sube de prioridad.
Si aparece un inversor, Capa 8 sube primero.

---

## Referencia

- MVP completado: Fases 0-9, 34 migraciones, 6 auditorías 0C/0H
- Handoff Fase 9: `docs/handoffs/2026-03-04_fase9_audit_session.md`
- Arquitectura actual: `docs/ARCHITECTURE.md`
- PRD actual: `docs/PRD.md`
