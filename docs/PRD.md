# PymePilot - Product Requirements Document (PRD)

**Version:** 2.0
**Fecha original:** 2026-02-19
**Ultima actualizacion:** 2026-03-04
**Autor:** Pato (fundador) + Codex
**Estado:** MVP operativo, en produccion para IEY

---

## 1. Vision y Problema

### El problema

El mercado tiene mil herramientas para adquirir y cerrar clientes. Nadie construyo el tapon.

La principal fuga de cualquier comercio es la misma: **el negocio vende, el cliente se va, no hay mas registro de esa persona.** Nadie esta dedicado 100% a la fidelizacion post-venta inteligente.

| Etapa | Herramientas existentes | Estado |
|-------|------------------------|--------|
| Adquisicion | Meta Ads, Google Ads, funnels | Saturado |
| Cierre de venta | CRMs, chatbots, cotizadores | Saturado |
| Post-venta / Fidelizacion | Email marketing generico, puntos | Nadie lo resuelve bien |
| Reactivacion inteligente | Nada | Vacio total |

### La solucion

**PymePilot** es un sistema de seguimiento pre y post venta + fidelizacion inteligente. Ocupa el unico espacio vacio del ciclo comercial: la etapa entre que se cierra una venta y la proxima compra.

**En una linea:** PYMEPILOT convierte cada venta en el inicio de una relacion, no en el fin de una transaccion.

**Core Engine:**
```
Venta ocurre
→ Cliente registrado automaticamente
→ Patron de comportamiento analizado
→ Momento optimo de contacto detectado
→ Mensaje personalizado enviado (WhatsApp)
→ Respuesta procesada por IA
→ Relacion mantenida viva indefinidamente
```

Canal principal: **WhatsApp Business API**. Lo que Claude AI hace — hablar a una persona especifica, en el momento exacto, sobre lo que esa persona especificamente compro — es lo que ninguna automatizacion tradicional puede replicar.

### Validacion real

Este sistema fue validado manualmente durante 6 meses en **IEY** (Distribuidor #1 de Accesorios MagSafe en Argentina):

| Metrica | Antes | Despues | Mejora |
|---|---|---|---|
| Facturacion recurrente | 34% | 74% | **+114.8%** |
| Clientes perdidos/mes | 18% | 8% | **-56%** |
| Ticket promedio recurrente vs nuevo | - | +88.4% | **+88.4%** |
| Conversion nuevos a recurrentes | 30% | 68% | **+126%** |

Estos resultados se lograron haciendo TODO manualmente: revisando planillas, calculando frecuencias a mano, y contactando uno por uno. PymePilot automatiza este proceso completo.

### Estado actual del sistema (post-MVP)

El MVP fue alcanzado el 2026-02-26, 7 dias despues de iniciar desarrollo. El sistema opera en produccion para IEY con:
- **4 verticales activas** (Reposicion, Activacion, Cross-Sell, Recuperacion)
- **165 clientes** en base de datos (post-deduplicacion)
- **2,492 productos** sincronizados
- **351 ordenes** historicas
- **Ejecucion automatica diaria** a las 5 AM sin intervencion
- **Dashboard operativo** en `app.pymepilot.cloud`
- **Monitoreo Grafana** con 2 dashboards (operaciones + costos)
- **Costo operativo Claude API:** ~$1.50-2.00/mes para IEY

---

## 2. Usuarios

### 2.1 Vendedor (usuario principal del dia a dia)

**Quien es:** Persona del equipo comercial que contacta clientes por WhatsApp/telefono.

**Que necesita:**
- Ver cada manana "a quien contactar hoy" con prioridad clara
- Mensaje sugerido listo para copiar y enviar
- Marcar como "contactado" o "ignorar" con un toque
- Enviar por WhatsApp con un boton
- Funciona bien en celular (su herramienta principal)

**Frecuencia de uso:** Todos los dias laborales, primera hora de la manana.

**Estado:** Implementado. Pagina `/contactar` con filtro por vertical, boton copiar, boton WhatsApp (wa.me), y acciones contactado/posponer/ignorar.

### 2.2 Admin del Distribuidor

**Quien es:** Dueno, gerente comercial, o encargado del canal mayorista.

**Que necesita:**
- Ver KPIs de valor generado (cuanto facturamos gracias a PymePilot)
- Ver metricas avanzadas: facturacion, churn, ticket promedio, valor atribuido
- Ranking de clientes con tendencia y detalle
- Exportar reportes a Excel y PDF
- Ver el estado de sincronizacion de datos con el ERP
- Configurar conexion ERP desde el dashboard

**Frecuencia de uso:** Semanal/quincenal para revisar metricas.

**Estado:** Implementado. Pagina `/metricas` con 4 KPI cards, 4 graficos Recharts, ranking expandible, exports Excel (4 hojas) y PDF. Pagina `/datos` con estado sync y card ERP.

### 2.3 Viewer

**Quien es:** Gerente general o socio que quiere ver resultados sin operar.

**Que necesita:**
- Dashboards de KPIs
- Reportes exportables
- Vista de tendencias

**Frecuencia de uso:** Mensual.

**Estado:** Cubierto por las paginas de metricas + exports del Admin.

### 2.4 Super Admin (Pato)

**Quien es:** Administrador del sistema completo (plataforma multi-tenant).

**Que necesita:**
- Crear y gestionar tenants (distribuidores)
- Monitorear salud del sistema
- Ver metricas de todos los tenants
- Configurar conectores ERP

**Frecuencia de uso:** Segun demanda.

**Estado:** Implementado. Script `create_tenant.py` para onboarding. Grafana con dashboards de operaciones y costos. `docs/ONBOARDING.md` con guia completa.

---

## 3. Funcionalidades Core: Las 4 Verticales

PymePilot tiene 4 "verticales" de seguimiento. Cada una ataca un momento diferente del ciclo de vida del cliente.

```
CICLO DE VIDA DEL CLIENTE EN UN DISTRIBUIDOR B2B:

  [LEAD] --> [PRIMERA COMPRA] --> [RECURRENTE] --> [INACTIVO] --> [PERDIDO]
                    |                   |                |
                    V                   V                V
              VERTICAL 1          VERTICAL 2        VERTICAL 4
            (Activacion)       (Reposicion)      (Recuperacion)
                                    |
                                    V
                              VERTICAL 3
                             (Cross-Sell)
```

**Estado:** Las 4 verticales estan implementadas y operativas para IEY.

### 3.1 Vertical 2: Reposicion Predictiva

**Estado:** OPERATIVA (desde Fase 2, 2026-02-22)
**Frecuencia:** Diaria (5 AM)

**Como funciona:**
1. Analiza historial de compras de cada cliente (fechas, productos, cantidades)
2. Calcula la frecuencia de compra por producto/categoria
3. Estima CUANDO va a necesitar reponer
4. 7-14 dias antes de la fecha estimada, genera una alerta con mensaje personalizado
5. El vendedor ve la alerta en el dashboard y contacta al cliente

**Factores de confianza (5):** regularidad del patron, recencia de compra, volumen historico, antiguedad del cliente, varianza de intervalos.

**Datos de salida (prediccion):**
- Cliente a contactar
- Fecha recomendada de contacto
- Productos que necesita reponer (con cantidades estimadas)
- Mensaje personalizado generado por Claude
- Score de confianza (0 a 1)
- Prioridad (1=alta, 5=baja)

### 3.2 Vertical 1: Activacion de Clientes Nuevos

**Estado:** OPERATIVA (desde Fase 5, 2026-02-26)
**Frecuencia:** Diaria (5 AM)

**Como funciona:**
1. Detecta automaticamente cuando un cliente hace su PRIMERA compra
2. Inicia una secuencia de seguimiento:
   - **Dia 7:** "Que tal te fue con el pedido? Necesitas algo mas?"
   - **Dia 15:** "Tenemos estos productos que complementan tu primera compra..."
   - **Dia 25:** "Muchos clientes como vos reponen en este momento. Queres que te reserve?"
3. Si el cliente compra de nuevo antes del dia 30, se "gradua" a recurrente
4. Si NO compra en 30 dias, genera alerta urgente

**Factores de confianza (3):** dias desde primera compra, monto primera compra, cantidad de productos en primera compra.

### 3.3 Vertical 4: Recuperacion de Clientes Inactivos

**Estado:** OPERATIVA (desde Fase 5, 2026-02-26)
**Frecuencia:** Diaria (5 AM)

**Como funciona:**
1. Detecta clientes inactivos segun ventanas de tiempo:
   - **60 dias sin comprar:** Alerta temprana
   - **90 dias:** Alerta media
   - **120 dias:** Alerta critica
2. Calcula score de probabilidad de recuperacion
3. Genera mensajes escalonados segun nivel de urgencia

**Factores de confianza (4):** historial de compras previo, recencia, monto historico, tendencia de compra.

### 3.4 Vertical 3: Cross-Sell Inteligente

**Estado:** OPERATIVA (desde Fase 7, 2026-02-28)
**Frecuencia:** Semanal (lunes)

**Como funciona:**
1. Materialized View `co_purchases` identifica pares de productos comprados juntos por >=3 clientes diferentes
2. Para cada cliente, encuentra productos que NUNCA compro pero que son comprados frecuentemente junto con los que SI compra
3. Genera recomendacion personalizada con hasta 3 productos complementarios
4. Maximo 5 candidatos por ejecucion (control de costos)

**Factores de confianza (4):** co_purchase_strength, customer_history, product_popularity, recency.

**Costo por ejecucion:** ~$0.011 USD (5 candidatos)

---

## 4. Ingesta de Datos

La calidad del sistema depende 100% de la calidad y frescura de los datos.

### 4.1 Arquitectura de Conectores

```
Canal 1: [Contabilium API] ---> [ContabiliumConnector] ---+
                                                           |
Canal 2: [Excel Upload]    ---> [SmartFileConnector]  ---+--> [SyncEngine] --> [PostgreSQL]
                                                           |
Canal 3: [Google Drive]    ---> [SmartFileConnector]  ---+
```

### 4.2 Canal 1: Contabilium (API REST)

**Estado:** OPERATIVO
- **Frecuencia:** Diaria (5 AM, automatica via cron)
- **Auth:** OAuth2 client_credentials
- **Datos:** Clientes, productos, ordenes de venta (PV 0003 mayorista)
- **Requisito:** Plan Full de Contabilium (incluye acceso API)
- **Fix aplicado:** IPv4HTTPAdapter resuelve bloqueo de Cloudflare

### 4.3 Canal 2: Smart File Upload

**Estado:** OPERATIVO
- **Frecuencia:** Bajo demanda (upload manual via dashboard)
- **Flujo:** Upload → Storage → Worker (cron 1min) → Claude parsea → SyncEngine
- **Costo:** ~$0.009 USD por archivo
- **Incremental:** hash SHA256 evita reprocesar archivos identicos

### 4.4 Canal 3: Google Drive

**Estado:** OPERATIVO
- **Frecuencia:** Diaria (4:30 AM, automatica via cron)
- **Auth:** Service Account
- **Estructura:** Un folder por tenant en Drive compartido

### 4.5 Conectores Futuros

ERPs populares en el mercado mayorista argentino a considerar:
- Xubio
- Alegra
- Colppy
- Sistemas propios / bases de datos ad-hoc

Cada nuevo ERP solo requiere crear un nuevo conector que implemente `ERPConnector` (clase abstracta). El resto del sistema no cambia.

---

## 5. Lo que NO es PymePilot

- **No es un CRM** — No reemplaza Salesforce ni HubSpot. Los complementa dandoles inteligencia sobre a quien contactar y cuando.
- **No es un ERP** — No gestiona facturacion, stock, logistica ni contabilidad. LEE datos del ERP, no los modifica. Solo GET, NUNCA escribe en el ERP del cliente.
- **No es una herramienta de adquisicion** — No genera leads ni gestiona funnels de ventas. Su lugar es despues de la primera venta.
- **No funciona sin historial** — Necesita al menos 3 meses de datos de compras para generar predicciones confiables.
- **No gestiona pagos ni cobros** — No procesa transacciones financieras.

**Nota de roadmap:** En el estado actual (Pilar 1), los mensajes son sugeridos y el vendedor los envia manualmente. Con Pilar 3 (Multi-Agente), el sistema podra responder conversaciones de forma autonoma dentro de reglas definidas.

---

## 6. Metricas de Exito

### 6.1 MVP (alcanzado 2026-02-26)

| Metrica | Criterio | Estado |
|---|---|---|
| Sync automatico | Datos de IEY se sincronizan sin intervencion | CUMPLIDO — 5 AM diario |
| Predicciones generadas | Motor genera predicciones para clientes IEY | CUMPLIDO — 4 verticales |
| Usabilidad | Vendedor puede ver lista y copiar desde celular | CUMPLIDO — mobile-first |
| Flujo completo | ERP → sync → prediccion → mensaje → dashboard | CUMPLIDO — end-to-end |
| Control de costos | <$5 USD/mes por tenant en Claude API | CUMPLIDO — ~$1.50-2.00/mes |

### 6.2 Plataforma (en progreso)

| Metrica | Criterio | Estado |
|---|---|---|
| Tenants | 2+ distribuidores operativos | PENDIENTE — infraestructura lista |
| Churn | Reduccion medible de clientes perdidos | MEDIBLE — dashboard /metricas |
| Facturacion | Incremento medible de facturacion recurrente | MEDIBLE — KPIs + atribucion |
| Onboarding | < 1 dia para activar nuevo distribuidor | LISTO — script + ONBOARDING.md |
| Verticales | Al menos 3 de 4 verticales operativas | CUMPLIDO — 4/4 operativas |

---

## 7. Requisitos Tecnicos

### 7.1 Stack

| Componente | Tecnologia | Estado |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui | Operativo |
| Base de datos | PostgreSQL 15 (Supabase self-hosted) | Operativo |
| Auth | Supabase GoTrue con tenant_id en JWT | Operativo |
| Motor IA | Python 3.11 + Anthropic Claude Sonnet | Operativo |
| Conectores | Python (requests + pandas + openpyxl) | 3 conectores operativos |
| Monitoreo | Grafana + Prometheus | 2 dashboards configurados |
| Deploy | Docker + Traefik SSL en Contabo VPS | Operativo |

### 7.2 Multi-Tenant

- Cada distribuidor es un "tenant" aislado
- Todos los datos en las mismas tablas con `tenant_id` en cada fila
- Row Level Security (RLS) con FORCE RLS garantiza aislamiento
- Usuario DB `pymepilot_app` (nosuperuser) — nunca usa postgres
- Testing de aislamiento con 12 tests automatizados
- Onboarding automatizado via `create_tenant.py`

### 7.3 Seguridad

- Autenticacion obligatoria para todas las rutas
- RLS en TODAS las tablas con datos de tenant (9 tablas)
- Secrets en variables de entorno (nunca en codigo)
- Backups automaticos diarios (3 AM, retencion 7 dias)
- Testing de aislamiento entre tenants
- CORS restringido a `app.pymepilot.cloud`
- Credenciales ERP encriptadas en reposo (Fernet AES-128)
- SanitizingFormatter previene leak de secrets en logs
- Grafana con usuario read-only que solo ve VIEWs agregadas
- Auditorias de seguridad en cada fase (0 CRITICAL, 0 HIGH en produccion)

---

## 8. Riesgos y Mitigaciones

| Riesgo | Estado | Resolucion |
|---|---|---|
| API de Contabilium con limitaciones | RESUELTO | IPv4HTTPAdapter para Cloudflare, OAuth2 OK |
| Claude API costosa a escala | MITIGADO | 4 capas de control, ~$1.50-2.00/mes por tenant |
| Predicciones de baja calidad | VALIDADO | Prompts iterados con feedback IEY, score de confianza |
| Supabase self-hosted mantenimiento | MITIGADO | Backups diarios, Grafana monitoring, docs completos |
| Clientes no exportan datos | RESUELTO | 3 canales: API, Smart Upload, Google Drive |
| Aislamiento entre tenants | VERIFICADO | 12 tests automatizados, RLS + FORCE RLS |

---

## 9. Dependencias Externas

| Dependencia | Tipo | Estado |
|---|---|---|
| Contabilium API | Critica | CONECTADA y operativa |
| Anthropic Claude API | Critica | OPERATIVA, Sonnet, $5 cargados |
| Google Drive API | Opcional | CONECTADA, Service Account |
| WhatsApp Cloud API | **Core** (Pilar 1 y 2) | PENDIENTE — Pilar 1 en produccion via wa.me, API directa requiere SIM chip |
| Supabase stack (Docker) | Infraestructura | OPERATIVO y estable |

---

## Apendice: Glosario

| Termino | Significado |
|---|---|
| **Tenant** | Un distribuidor/cliente que usa PymePilot. Cada tenant tiene sus datos aislados. |
| **Vertical** | Un tipo de seguimiento/analisis especifico (Activacion, Reposicion, Cross-Sell, Recuperacion). |
| **Prediccion** | Una recomendacion generada por el motor: "contacta a X, ofrecele Y, porque Z". |
| **Sync** | El proceso de sincronizar datos del ERP del cliente con la base de datos de PymePilot. |
| **Conector** | Un plugin que se conecta a un ERP especifico y traduce sus datos al formato de PymePilot. |
| **RLS** | Row Level Security. Mecanismo de PostgreSQL que filtra datos por tenant automaticamente. |
| **ERP** | Enterprise Resource Planning. Sistema de gestion (facturacion, stock, etc.) que usa el distribuidor. |
| **Churn** | Tasa de perdida de clientes. % de clientes que dejan de comprar en un periodo. |
| **Cross-Sell** | Vender productos adicionales/complementarios a un cliente existente. |
| **Score de confianza** | Numero de 0 a 1 que indica que tan seguro esta el motor de una prediccion. |
| **Atribucion** | Proceso de conectar una prediccion con una compra real que ocurrio despues. |
| **co_purchases** | Materialized View que identifica productos comprados frecuentemente juntos. |
| **Orquestador** | Script que ejecuta automaticamente sync + verticales cada dia a las 5 AM. |
