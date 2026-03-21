# PymePilot - Roadmap de Desarrollo

**Version:** 2.0
**Fecha original:** 2026-02-19
**Ultima actualizacion:** 2026-03-04
**Duracion estimada original:** 22 semanas (5.5 meses)
**Duracion real:** 13 dias (2026-02-19 a 2026-03-04)

---

## Vision General

```
Feb 19    Feb 20-22    Feb 23       Feb 24-25       Feb 26
  |          |           |             |               |
  v          v           v             v               v
[SETUP] -> [ERP+V2] -> [DASH] -> [INGESTA v2] -> [AUTO+V1+V4]
  DB      Contabilium  Next.js   Smart Upload    Orquestador
  Git     Motor V2     Login     Drive + Notif    Activacion
  Python  Claude AI    Deploy    Incremental      Recuperacion
                                                      |
                                             HITO MVP -->
                                             Sistema funciona
                                             para IEY sin
                                             intervencion manual

Feb 27      Feb 28        Mar 03       Mar 04
  |            |             |            |
  v            v             v            v
[WHATSAPP] -> [V3+KPI] -> [MULTI] -> [PRODUCCION]
Boton wa.me  Cross-Sell   Onboarding  Grafana
Kommo CRM    8 RPCs      Isolation   Seguridad
eliminado    Ranking      Tests      Documentacion
```

---

## Fase 0: Fundacion y Setup

**Fecha:** 2026-02-19 (1 dia)
**Estado:** COMPLETADA
**Estimacion original:** 1 semana

### Entregable
Repositorio Git inicializado, 10 migraciones SQL ejecutadas, tenant IEY registrado, connection pooling con tenant context.

### Lo que se hizo
- 10 migraciones (001-010): extensiones, tenants, user_profiles, customers, products, orders, predictions, sync_log, indexes, helpers
- Tenant IEY creado con `erp_type = 'contabilium'`
- `backend/engine/db/connection.py` con pool y `set_tenant_context()`
- Virtual environment Python, `.gitignore`, estructura de carpetas

---

## Fase 1: Conectores ERP + Carga de Datos IEY

**Fecha:** 2026-02-20 a 2026-02-25 (completada con sync full el 26)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 2 semanas
**Commits:** `19d4940`, `c02f1f8`, `5955b35`, `890d58a`, `d39a245`, `fbba679`, `7c9a4ab`

### Entregable
3 conectores ERP operativos (Contabilium API, Excel, Smart File Upload), datos reales de IEY sincronizados.

### Lo que se hizo
- **ERPConnector** (clase abstracta) con 3 implementaciones: Contabilium, Excel, SmartFile
- **Contabilium:** OAuth2, IPv4HTTPAdapter para resolver Cloudflare, PV 0003 mayorista
- **ExcelConnector:** lectura .xlsx/.csv con validacion de columnas
- **SmartFileConnector:** Claude parsea cualquier Excel (Canal 2, Fase Smart Upload)
- **SyncEngine:** upsert con deteccion de nuevos/actualizados, `sync_log` completo
- **crypto.py:** encriptacion de credenciales ERP con Fernet
- **Sync full IEY:** 229 clientes, 2,492 productos, 351 ordenes
- **Auditoria:** 0C, 0H

### Datos reales IEY
| Tabla | Registros |
|-------|-----------|
| customers | 229 (165 despues de dedup) |
| products | 2,492 |
| orders | 351 |

---

## Fase 2: Motor Inteligente - V2 Reposicion Predictiva

**Fecha:** 2026-02-22 (1 dia)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 2 semanas
**Commit:** `4d9e92a` (13 archivos, 2,362 lineas)

### Entregable
Motor con V2 Reposicion, Claude API integrado con 4 capas de control de costos, script de atribucion.

### Lo que se hizo
- **VerticalBase:** Template Method pattern (get_candidates → build_prompt → generate → save)
- **VerticalReposicion:** 5 factores de confianza, ventana 7-14 dias
- **ClaudeClient:** Anthropic SDK, retry con backoff, tracking de tokens
- **4 capas costos:** limite diario DB → techo por llamada → registro finally → alertas log
- **Modelo:** claude-sonnet-4-20250514
- **Prompt:** conversacional, 3-6 productos, tono por perfil (VIP/Regular/Nuevo)
- **Script atribucion:** `run_attribution.py` para medir valor generado
- **Costo testing:** $0.014 USD (5 llamadas, 2,969 tokens)
- **Auditoria:** 2 rondas, 4 fixes. Final: 0C/0H

---

## Fase 3: Dashboard MVP

**Fecha:** 2026-02-23 (1 dia)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 3 semanas
**Commit deploy:** `5a5f52c`

### Entregable
Dashboard Next.js en `app.pymepilot.cloud` con login, 4 paginas, mobile-first.

### Lo que se hizo
- **Next.js 16** con App Router, TypeScript strict, Tailwind + shadcn/ui
- **Supabase SSR auth** con middleware de proteccion de rutas
- **4 paginas:** KPIs (home), Contactar Hoy, Historial, Estado de Datos
- **Deploy:** Docker multi-stage + Traefik SSL en `app.pymepilot.cloud`
- **GoTrue fixes:** aud, tokens, search_path, 43 migraciones de auth
- **Kong:** JWTs reales firmados con JWT_SECRET (HS256)
- **Auditoria:** 2H+6M+4L corregidos

---

## Smart File Upload (entre Fase 3 y 4)

**Fecha:** 2026-02-24 (1 dia)
**Estado:** COMPLETADO
**Commit:** `798a961` (10 archivos, 1,822 lineas)

### Entregable
Canal 2 de ingesta: upload de Excel via dashboard, Claude parsea automaticamente.

### Lo que se hizo
- **Flujo:** Upload → Supabase Storage → Worker cron 1min → Claude analiza → SyncEngine importa
- **SmartFileConnector:** Claude identifica columnas automaticamente
- **Test E2E:** 32 clientes, 226 productos, 44 ordenes desde Excel IEY
- **Costo por upload:** ~$0.009 USD (~2k tokens)

---

## Ingesta Fase 2 (entre Fase 3 y 4)

**Fecha:** 2026-02-25 (1 dia)
**Estado:** COMPLETADA + AUDITADA
**Commits:** `601ff0c`, `d4805b9`, `c231c37`

### Entregable
Upload incremental, Google Drive sync, notificaciones en dashboard.

### Lo que se hizo
- **Incremental:** hash SHA256 evita reprocesar archivos identicos
- **Google Drive:** Service Account, sync diario 4:30 AM, folder por tenant
- **Notificaciones:** toast en dashboard con estado del upload
- **Auditoria:** 3 rondas, 30 fixes. Final: 0C/0H

---

## Fase 4: Automatizacion

**Fecha:** 2026-02-26 (1 dia)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 1 semana
**Commit:** `3c39938`

### Entregable
Orquestador diario automatico, 5 jobs en crontab.

### Lo que se hizo
- **Orquestador** `backend/main.py`: sync → atribucion → verticales, por tenant
- **VERTICAL_REGISTRY** centralizado en `__init__.py`
- **Migracion 024:** tabla `orchestrator_runs` + campo `active_verticals` en tenants
- **Crontab 5 jobs:** backup 3AM, uploads 1min, Drive 4:30AM, orquestador 5AM con flock, freshness 5:30AM
- **Datos IEY post-orquestador:** 229 clientes, 2,492 productos, 351 ordenes, 32 predicciones
- **Auditoria:** 5 HIGH corregidos. Final: 0C/0H

### HITO MVP ALCANZADO (2026-02-26)

> **El sistema funciona para IEY sin intervencion manual.**
>
> Cada manana: datos se sincronizan automaticamente desde Contabilium →
> motor analiza y genera predicciones → vendedor abre
> `app.pymepilot.cloud` y ve la lista de clientes a contactar hoy
> con mensajes personalizados.
>
> **Duracion hasta MVP:** 7 dias (estimacion original: 9 semanas).

---

## Fase 5: Verticales 1 y 4

**Fecha:** 2026-02-26 (mismo dia que Fase 4)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 3 semanas
**Commit:** `ddd4226` (10 archivos, 972 lineas)

### Entregable
V1 Activacion y V4 Recuperacion operativas con dashboard actualizado.

### Lo que se hizo
- **V1 Activacion:** secuencia 7/15/25 dias, 3 factores confianza, perfil='Nuevo'
- **V4 Recuperacion:** ventanas 60/90/120 dias, 4 factores, classify_profile override
- **Dashboard:** chips filtro por vertical, badges con color y contexto, ventana 3 dias
- **IEY:** active_verticals incluye reposicion + activacion + recuperacion
- **Testing:** V4 genero 2 mensajes reales ($0.008 USD)
- **Limpieza:** 64 clientes duplicados eliminados
- **Auditoria:** 4 HIGH corregidos. Final: 0C/0H

---

## Fase 6: WhatsApp

**Fecha:** 2026-02-27 (1 dia)
**Estado:** Parte 1 COMPLETADA, Parte 2 PENDIENTE (bloqueada por SIM chip)
**Estimacion original:** 2 semanas
**Commit:** `be1dc66`

### Entregable
Boton wa.me en cada prediccion del dashboard.

### Lo que se hizo
- **Kommo CRM ELIMINADO** del plan — ningun PyME argentino tiene CRM
- **Boton wa.me:** copia mensaje + abre WhatsApp, vendedor busca contacto y pega
- **Sin telefono en link:** 74% de clientes IEY sin dato de telefono
- **3 iteraciones UX** con Pato hasta diseno final

### Pendiente (Parte 2)
- Notificacion diaria via WA Cloud API
- Bloqueante: SIM chip para verificar numero en Meta Business
- Arquitectura y tabla wa_notifications documentadas en design doc

---

## Fase 7: V3 Cross-Sell + KPIs Avanzados

**Fecha:** 2026-02-27 a 2026-02-28 (2 dias)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 3 semanas
**Commits:** `42a4192`, `ab4c93c`, `79b7a20`, `c499620`

### Entregable
V3 Cross-Sell operativa, pagina /metricas con 4 KPIs + 4 graficos + ranking, exports Excel y PDF.

### Lo que se hizo
- **V3 Cross-Sell:** co_purchases MV, semanal (lunes), 5 candidatos max, 3 productos por mensaje
- **8 RPCs:** revenue_split, churn, ticket, value, top_products, client_trends, client_monthly_revenue
- **VIEW:** client_rankings_secure (filtro tenant sobre MV sin RLS)
- **4 charts Recharts:** facturacion mensual, churn, ticket promedio, valor atribuido
- **4 KPI cards** con tendencia mensual
- **Ranking expandible** con detalle por cliente (top 5 productos, predicciones activas)
- **Exports:** Excel 4 hojas (SheetJS) + PDF resumen ejecutivo (react-pdf)
- **Costo V3 IEY:** $0.011 USD por ejecucion
- **Auditoria:** 2H + 3M corregidos. Final: 0C/0H

---

## Fase 8: Multi-Tenant Productivo

**Fecha:** 2026-03-03 (1 dia)
**Estado:** COMPLETADA + AUDITADA
**Estimacion original:** 3 semanas
**Commits:** `3f11d79`, `c69bd29`

### Entregable
Sistema listo para segundo tenant con script de onboarding, testing de aislamiento, y deuda tecnica resuelta.

### Lo que se hizo
- **Script `create_tenant.py`:** 5 pasos interactivos (datos, DB, GoTrue, ERP, verificacion)
- **Dashboard Card ERP:** `erp-status-card.tsx` con 5 estados visuales
- **Testing aislamiento:** `tenant_isolation_test.sql` con 12 tests
- **Migracion 031:** REVOKE SELECT tenants + VIEW tenant_info_secure + 3 SECURITY DEFINER functions
- **Dedup resuelto:** normalize_customer_name() elimina duplicados cross-canal
- **Documentacion:** `docs/ONBOARDING.md` guia completa
- **Auditoria:** 1C + 3H corregidos. Final: 0C/0H

---

## Fase 9: Pulido y Produccion

**Fecha:** 2026-03-04 (1 dia)
**Estado:** EN CURSO
**Estimacion original:** 2 semanas

### Entregable
Monitoreo con Grafana, deuda tecnica de seguridad y calidad resuelta, documentacion actualizada.

### Lo que se hizo

#### Bloque 1+2: Grafana Monitoring + Dashboard Operaciones
- **Migracion 032:** rol `grafana_reader` + 4 VIEWs de monitoreo (operaciones, costos, syncs, predicciones)
- **Dashboard "PymePilot — Operaciones":** 6 paneles (estado, predicciones, syncs, historial, errores)
- **Datasource PostgreSQL** configurado en Grafana

#### Bloque 3: Dashboard Costos Claude
- **Dashboard "PymePilot — Costos Claude":** 6 paneles (gasto diario, gauge tokens, acumulado mensual, tokens/dia, costo/dia, llamadas/dia)
- **Gauge** con umbrales visuales: verde <70k, amarillo 70-90k, rojo >90k tokens

#### Bloque 4: Deuda Tecnica de Seguridad
- **Migracion 033:** 3 fixes SQL
  - EXCEPTION WHEN OTHERS → excepciones especificas (feature_not_supported, lock_not_available)
  - Cast inseguro attribution_amount → validacion regex antes de ::numeric
  - DoS en parametros → LEAST(p_months, 24) en 6 RPCs
- **CORS:** `origins: ["*"]` → `origins: ["https://app.pymepilot.cloud"]` en Kong

#### Bloque 5: Deuda Tecnica de Calidad
- **formatCurrency centralizado:** `frontend/src/lib/format.ts` reemplaza 7 copias
- **Types fix:** `any` → `TooltipContentProps<ValueType, NameType>` en 4 charts
- **loading.tsx:** skeleton para /metricas
- **UNION ALL documentado** en cross_sell query

#### Bloque 6: Documentacion (en curso)
- Actualizar ROADMAP.md, PRD.md, crear ARCHITECTURE.md

#### Bloque 7: Auditoria Final
- Pendiente

---

## Resumen de Hitos

| Fecha | Fase | Que se logro |
|-------|------|-------------|
| Feb 19 | 0 - Setup | DB lista, Python conecta, tenant IEY creado |
| Feb 22 | 1+2 | Contabilium conectado, V2 Reposicion generando predicciones |
| Feb 23 | 3 | Dashboard en app.pymepilot.cloud, login, mobile-first |
| Feb 24-25 | Ingesta | Smart Upload + Drive + incremental |
| **Feb 26** | **4+5 - MVP** | **Todo automatico para IEY. 3 verticales activas.** |
| Feb 27 | 6 | WhatsApp via wa.me (Kommo eliminado) |
| Feb 28 | 7 | V3 Cross-Sell + KPIs + ranking + exports |
| Mar 03 | 8 | Multi-tenant productivo, onboarding script |
| Mar 04 | 9 | Grafana, seguridad, calidad, docs |

---

## Comparativa: Estimacion vs Realidad

| Fase | Estimacion | Real | Factor |
|------|-----------|------|--------|
| 0 Setup | 1 semana | 1 dia | 7x |
| 1 ERP | 2 semanas | 2 dias | 7x |
| 2 Motor V2 | 2 semanas | 1 dia | 14x |
| 3 Dashboard | 3 semanas | 1 dia | 21x |
| 4 Automatizacion | 1 semana | 1 dia | 7x |
| 5 V1+V4 | 3 semanas | 1 dia | 21x |
| 6 WhatsApp | 2 semanas | 1 dia | 14x |
| 7 V3+KPIs | 3 semanas | 2 dias | 10.5x |
| 8 Multi-tenant | 3 semanas | 1 dia | 21x |
| 9 Produccion | 2 semanas | 1 dia | 14x |
| **Total** | **22 semanas** | **13 dias** | **~12x** |

---

## Post-MVP: Proximos Pasos

El norte estrategico es escalar progresivamente de mayoristas a minoristas y servicios, construyendo los 4 Pilares del sistema de forma secuencial.

### Pilar 2 — Webhooks + Analisis Reactivo (Mes 1-2)
- Webhook receiver HTTPS que captura respuestas de WhatsApp en tiempo real
- Claude AI analiza cada respuesta: intencion, emocion, objeciones, contexto
- Pipeline actualizado automaticamente segun la respuesta
- Nota de seguimiento personalizada para el vendedor
- Prerequisito: App Meta en modo Live + permiso `whatsapp_business_messaging`

### Pilar 3 — Arquitectura Multi-Agente (Mes 3-4)
- **Agente Analista** (primero, solo lectura): extrae intencion/emocion/objeciones, agenda siguiente contacto, mueve el lead en el pipeline
- **Agente Respondedor** (despues, supervisado): responde mensajes simples de forma autonoma, maneja objeciones frecuentes, escala al humano cuando es necesario
- Los dos agentes corren en paralelo: uno habla, el otro analiza y agenda

### Pilar 4 — Embedded Signup (Mes 3+, con 3 pilotos pagando)
- Cliente conecta su propio WhatsApp Business desde el dashboard en menos de 2 minutos
- Sin ayuda de Pato — modelo SaaS real (hoy: modelo agencia, ~1-2hs por cliente)
- Prerequisito: 3 clientes pilotos pagando antes de construirlo

### Escalera de mercado
```
HOY:       Distribuidoras mayoristas Argentina (~8.000 empresas)
MES 6-12:  + B2B similares (ferreterias, alimentos, ~25.000 empresas)
ANO 2:     Minorista Tipo A (servicios con turnos, ~80.000 comercios)
ANO 3+:    Minorista Tipo B/C + LATAM (~400.000+ comercios)
```

### Operativo pendiente
- SIM chip para activar WhatsApp Business API directa (desbloquea Pilar 1 completo)
- Primer cliente externo onboardeado (objetivo mes 1-2)
- Reactivacion crons con cron_wrapper.py (pendiente ticket Contabilium)
- Conectores adicionales: Xubio, Alegra, Colppy (bajo demanda de nuevos tenants)
