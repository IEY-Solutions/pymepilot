# PymePilot - Arquitectura del Sistema

**Version:** 1.1
**Fecha:** 2026-03-21

---

## 1. Vision General

PymePilot es un sistema de seguimiento pre y post venta + fidelizacion inteligente. Ocupa el espacio vacio entre el cierre de una venta y la proxima compra. Canal principal: WhatsApp Business API + Claude AI. Escala de mayoristas a minoristas progresivamente.

**En una linea:** PYMEPILOT convierte cada venta en el inicio de una relacion, no en el fin de una transaccion.

```
                        FUENTES DE DATOS
                    ┌──────────────────────┐
                    │  Contabilium API      │
                    │  Excel Upload         │
                    │  Google Drive         │
                    └──────────┬───────────┘
                               │
                     ┌─────────▼──────────┐
                     │   CONECTORES ERP    │
                     │   (Python)          │
                     │   sync diario 5AM   │
                     └─────────┬──────────┘
                               │
                     ┌─────────▼──────────┐
                     │   POSTGRESQL 15     │
                     │   (Supabase)        │
                     │   RLS multi-tenant  │
                     └──┬──────┬──────┬───┘
                        │      │      │
            ┌───────────┘      │      └───────────┐
            │                  │                  │
  ┌─────────▼──────┐ ┌────────▼───────┐ ┌────────▼───────┐
  │  MOTOR PYTHON   │ │  DASHBOARD     │ │  GRAFANA       │
  │  seguimiento    │ │  Next.js       │ │  Monitoring    │
  │  Claude API     │ │  PostgREST     │ │  grafana_reader│
  │  cron 5AM       │ │  GoTrue Auth   │ │  4 VIEWs       │
  └────────┬────────┘ └────────────────┘ └────────────────┘
           │
           ▼
     predictions
     (mensajes personalizados)
           │
           ▼
  ┌────────────────┐
  │  WHATSAPP      │
  │  Business API  │  ← Canal principal de comunicacion
  │  (Pilar 1 ✅)  │
  └────────┬───────┘
           │ respuestas
           ▼
  ┌────────────────┐
  │  WEBHOOKS +    │
  │  MULTI-AGENTE  │  ← Pilar 2 y 3 (en construccion)
  │  Claude AI     │
  └────────────────┘
```

### 4 Pilares del producto (roadmap arquitectonico)

| Pilar | Estado | Funcion |
|-------|--------|---------|
| 1 — Orquestador Proactivo | En produccion | Detecta inactivos, genera mensajes Claude AI, envia por WhatsApp |
| 2 — Webhooks + Analisis Reactivo | En desarrollo | Recibe respuestas en tiempo real, Claude analiza intencion/emocion |
| 3 — Multi-Agente | Fase siguiente | Agente Respondedor (conversacional) + Agente Analista (estrategico) en paralelo |
| 4 — Embedded Signup | Mes 3+ | Cliente conecta su propio WhatsApp Business desde el dashboard sin ayuda |

---

## 2. Stack Tecnologico

| Capa | Tecnologia | Version | Funcion |
|------|-----------|---------|---------|
| Frontend | Next.js (App Router) | 16.1.6 | Dashboard web mobile-first |
| UI | Tailwind CSS + shadcn/ui | 4 + latest | Componentes y estilos |
| Graficos | Recharts | 3.7 | Charts de KPIs y metricas |
| Exports | SheetJS + react-pdf | latest | Excel y PDF client-side |
| Auth | Supabase GoTrue | self-hosted | Login email/password, JWT con tenant_id |
| API Gateway | Kong | self-hosted | Ruteo, CORS, JWT validation |
| API REST | PostgREST | self-hosted | Auto-genera REST desde PostgreSQL |
| Base de datos | PostgreSQL | 15 | Datos + RLS + RPCs |
| Motor IA | Python | 3.11 | Verticales + sync + orquestador |
| LLM | Anthropic Claude API | Sonnet | Generacion de mensajes |
| Conectores | Python requests + pandas | latest | APIs ERP + Excel |
| Encriptacion | cryptography (Fernet) | 42+ | Credenciales ERP en reposo |
| Deploy | Docker + Docker Compose | latest | Contenedores Supabase stack |
| SSL/Proxy | Traefik | 2 | HTTPS + routing por dominio |
| Monitoreo | Grafana + Prometheus | 12.3 | Dashboards operacionales |
| Servidor | Contabo VPS | 12GB RAM | Linux, IP fija |

---

## 3. Estructura del Proyecto

```
pymepilot/
├── backend/
│   ├── engine/
│   │   ├── seguimiento/        # Modulo 1 (V1-V4 dentro de un solo modulo)
│   │   │   ├── __init__.py     # VERTICAL_REGISTRY centralizado
│   │   │   ├── base.py         # VerticalBase (clase abstracta)
│   │   │   ├── reposicion.py   # V2: prediccion de compra
│   │   │   ├── activacion.py   # V1: seguimiento clientes nuevos
│   │   │   ├── recuperacion.py # V4: reactivacion inactivos
│   │   │   └── cross_sell.py   # V3: productos complementarios
│   │   ├── connectors/         # Conectores ERP (Strategy pattern)
│   │   │   ├── base.py         # ERPConnector (clase abstracta)
│   │   │   ├── contabilium.py  # API REST Contabilium
│   │   │   ├── excel.py        # Archivos .xlsx/.csv
│   │   │   ├── smart.py        # Claude parsea cualquier Excel
│   │   │   ├── sync.py         # SyncEngine (upsert + sync_log)
│   │   │   └── crypto.py       # Encriptacion credenciales ERP
│   │   ├── claude/
│   │   │   └── client.py       # Anthropic SDK + 4 capas costos
│   │   ├── db/
│   │   │   ├── connection.py   # Pool + set_tenant_context()
│   │   │   └── queries.py      # 13 queries SQL parametrizadas
│   │   └── core/
│   │       └── logger.py       # SanitizingFormatter (redacta secrets)
│   ├── config/
│   │   ├── settings.py         # Configuracion desde .env
│   │   └── prompts/            # Prompts agrupados por modulo
│   │       ├── seguimiento/
│   │       │   ├── reposicion.txt
│   │       │   ├── activacion.txt
│   │       │   ├── recuperacion.txt
│   │       │   └── cross_sell.txt
│   │       ├── asesor_chat.txt
│   │       └── smart_upload.txt
│   ├── scripts/                # CLIs ejecutables
│   │   ├── sync_erp.py         # Sync manual: --tenant-slug iey
│   │   ├── run_vertical.py     # Ejecutar vertical: --vertical reposicion
│   │   ├── run_attribution.py  # Medir valor generado
│   │   ├── process_uploads.py  # Worker de uploads (cron 1min)
│   │   ├── create_tenant.py    # Onboarding nuevo tenant
│   │   └── setup_credentials.py
│   ├── main.py                 # Orquestador diario (cron 5AM)
│   ├── requirements.txt        # 10 dependencias Python
│   └── venv/                   # Virtual environment
├── database/
│   ├── migrations/             # 001-057 + rollbacks (114 archivos)
│   └── seed/                   # dev_data.sql (doble guard)
├── frontend/
│   ├── src/app/
│   │   ├── login/              # Pagina de login
│   │   └── (dashboard)/        # Layout autenticado
│   │       ├── page.tsx        # Home con KPIs
│   │       ├── pipeline/       # Pipeline CRM
│   │       ├── cuentas-clave/  # Key Account Management
│   │       ├── metricas/       # KPIs + charts + ranking
│   │       ├── logros/         # Mis ventas / atribucion
│   │       ├── datos/          # Estado sync + ERP card
│   │       ├── asesor/         # Asesor IA
│   │       └── guia/           # Onboarding y ayuda visual
│   ├── src/components/         # Componentes reutilizables
│   ├── src/lib/                # Utilidades + config de producto
│   │   └── products/           # Producto actual (Mayoristas)
│   └── Dockerfile              # Multi-stage build
├── grafana/dashboards/         # JSON exportados
│   ├── pymepilot-operaciones.json
│   └── pymepilot-costos.json
├── docs/                       # Documentacion
└── scripts/                    # Scripts de operaciones del servidor
    ├── backup-postgresql.sh
    ├── restore-postgresql.sh
    └── utilidades operativas
```

---

## 4. Flujo de Datos

### 4.1 Ingesta (3 canales)

```
Canal 1: API ERP (automatico, diario 5AM)
  Contabilium API → ContabiliumConnector → SyncEngine → PostgreSQL
  - OAuth2 con client_credentials
  - IPv4HTTPAdapter para resolver Cloudflare
  - Solo GET (lectura). NUNCA escribe en el ERP del cliente.

Canal 2: Smart Upload (manual, via dashboard)
  Excel → Supabase Storage → Worker (1min) → Claude parsea → SyncEngine → PostgreSQL
  - Claude identifica columnas automaticamente
  - Hash SHA256 evita reprocesar archivos identicos
  - Costo: ~$0.009 USD por upload

Canal 3: Google Drive (automatico, diario 4:30AM)
  Carpeta Drive → Service Account → descarga → SmartFileConnector → SyncEngine → PostgreSQL
  - Un folder por tenant
  - Solo procesa archivos nuevos (no descargados previamente)
```

### 4.2 Motor de Predicciones (diario 5AM)

```
Orquestador (main.py)
  │
  ├── 1. Sync ERP (por cada tenant activo)
  │     └── SyncEngine.sync_all() → customers, products, orders
  │
  ├── 2. Refresh de vistas materializadas (una sola vez)
  │     └── co_purchases + client_rankings
  │
  ├── 3. Atribucion (run_attribution)
  │     └── Marca predicciones que resultaron en compra real
  │
  └── 4. Verticales (por cada vertical activa del tenant)
        │
        ├── V2 Reposicion (diario)
        │   Candidatos: clientes cuya proxima compra estimada cae en ventana 7-14 dias
        │   5 factores: regularidad, recencia, volumen, antiguedad, varianza
        │
        ├── V1 Activacion (diario)
        │   Candidatos: clientes nuevos en secuencia dia 7/15/25
        │   3 factores: dias_desde_primera, monto_primera, cantidad_productos
        │
        ├── V4 Recuperacion (diario)
        │   Candidatos: clientes inactivos en ventanas 60/90/120 dias
        │   4 factores: historial, recencia, monto_historico, tendencia
        │
        └── V3 Cross-Sell (semanal, lunes)
            Candidatos: top 5 por co-purchase score
            co_purchases MV: pares de productos comprados juntos >=3 veces
            4 factores: co_purchase_strength, customer_history, product_popularity, recency

  Cada vertical sigue Template Method:
  get_candidates() → build_prompt() → Claude genera mensaje → save_prediction()
```

### 4.3 Dashboard (tiempo real via PostgREST)

```
Vendedor abre app.pymepilot.cloud
  │
  ├── GoTrue valida JWT → extrae tenant_id del claim
  │
  ├── PostgREST sirve datos → RLS filtra por tenant_id automaticamente
  │
  ├── Producto actual:
  │   └── `PymePilot Mayoristas`
  │
  ├── Navegacion:
  │   └── `frontend/src/lib/products/` define el producto actual y su nav
  │
  ├── Paginas:
  │   ├── /            → Inicio con KPIs
  │   ├── /pipeline    → Seguimiento comercial
  │   ├── /cuentas-clave → Key Account Management
  │   ├── /metricas    → 8 RPCs + VIEW client_rankings_secure
  │   ├── /logros      → Atribucion y rendimiento
  │   ├── /datos       → sync_log + upload_jobs + estado ERP
  │   ├── /asesor      → Chatbot IA
  │   └── /guia        → Onboarding y ayuda visual
  │
  └── Acciones del vendedor:
      ├── Copiar mensaje → clipboard
      ├── Enviar por WhatsApp → wa.me deep link
      ├── Marcar contactado/posponer/ignorar → PATCH prediction
      └── Exportar → Excel (4 hojas) o PDF (resumen ejecutivo)
```

---

## 5. Multi-Tenant

### Estrategia: tenant_id + RLS (no schema-per-tenant)

Todas las tablas de datos en schema `public` con columna `tenant_id`. Row Level Security (RLS) garantiza aislamiento.

```
┌─────────────────────────────────────────────────┐
│                 PostgreSQL                       │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Tabla: customers                         │   │
│  │  ┌──────────┬─────────┬────────────────┐  │   │
│  │  │tenant_id │ name    │ ...            │  │   │
│  │  ├──────────┼─────────┼────────────────┤  │   │
│  │  │ IEY      │ Juan    │ ...            │  │   │ ← Vendedor IEY
│  │  │ IEY      │ Maria   │ ...            │  │   │   solo ve estas
│  │  │ TENANT_B │ Pedro   │ ...            │  │   │ ← Invisible
│  │  │ TENANT_B │ Laura   │ ...            │  │   │   para IEY
│  │  └──────────┴─────────┴────────────────┘  │   │
│  │                                            │   │
│  │  RLS Policy:                               │   │
│  │  WHERE tenant_id = current_setting(        │   │
│  │    'app.current_tenant_id')                │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Tablas con RLS: customers, products, orders,    │
│  order_items, predictions, sync_log,             │
│  upload_jobs, notifications, orchestrator_runs   │
│                                                  │
│  Tablas sin RLS (globales):                      │
│  api_usage (costos Claude, sin tenant_id)        │
│                                                  │
│  Usuarios DB:                                    │
│  - postgres (superuser, owner)                   │
│  - pymepilot_app (nosuperuser, FORCE RLS)        │
│  - grafana_reader (SELECT solo en 4 VIEWs)       │
└─────────────────────────────────────────────────┘
```

### Contexto de Tenant

```
Motor Python:  set_tenant_context(conn, tenant_id)
               → SET LOCAL app.current_tenant_id = '...'

Dashboard:     JWT contiene tenant_id en app_metadata
               → PostgREST setea automaticamente via request.jwt.claims
```

---

## 6. Seguridad

### 6.1 Capas de Defensa

| Capa | Mecanismo | Protege |
|------|-----------|---------|
| Red | Traefik + HTTPS + CORS restringido | Transito |
| Gateway | Kong + JWT validation | Autenticacion |
| Auth | GoTrue email/password | Identidad |
| DB | RLS + FORCE RLS | Aislamiento de datos |
| App | pymepilot_app (nosuperuser) | Privilegio minimo |
| Credenciales | Fernet AES-128 en reposo | Secrets ERP |
| Logs | SanitizingFormatter | Previene leak de secrets |
| Monitoreo | grafana_reader (solo VIEWs agregadas) | Datos sensibles |
| ERP | Solo GET, clase abstracta sin POST/PUT/DELETE | Sistema del cliente |

### 6.2 Tablas Sensibles Protegidas

| Dato | Proteccion |
|------|-----------|
| Credenciales ERP | Fernet en tenants.erp_config, SECURITY DEFINER para save |
| Mensajes de prediccion | RLS por tenant_id, no expuestos en VIEWs de Grafana |
| Datos de clientes | RLS, sin acceso directo a authenticated, VIEW solo agrega |
| API key Claude | Solo en .env (permisos 600), SanitizingFormatter |
| Passwords | GoTrue (bcrypt), nunca en texto plano |

### 6.3 Auditorias Realizadas

Cada fase paso por auditoria de seguridad con 3 agentes especializados (security-guardian, db-architect, python-engine). Todas las fases terminaron con 0 CRITICAL y 0 HIGH.

---

## 7. Infraestructura

### 7.1 Servidor

```
Contabo VPS
  OS:     Linux (Ubuntu)
  RAM:    12 GB
  Docker: Supabase stack en /opt/orion-stack/
  App:    /home/pato/projects/pymepilot/
  User:   pato (sin sudo sin terminal)
```

### 7.2 Docker Compose (Supabase Stack)

```
/opt/orion-stack/docker-compose.yml

Containers:
  orion-menteax_postgres    → PostgreSQL 15 (172.18.0.10:5432)
  orion-menteax_kong        → API Gateway (puerto 8000)
  orion-menteax_auth        → GoTrue (auth)
  orion-menteax_rest        → PostgREST
  orion-menteax_storage     → Supabase Storage
  orion-menteax_grafana     → Grafana (puerto 3001)
  orion-menteax_prometheus  → Prometheus
  traefik                   → Reverse proxy + SSL
  pymepilot-frontend        → Next.js (standalone)
```

### 7.3 Dominios

| Dominio | Servicio |
|---------|---------|
| app.pymepilot.cloud | Dashboard Next.js |
| devapi.menteax.com | Kong (PostgREST + GoTrue + Storage) |
| grafana.menteax.com | Grafana |

### 7.4 Crontab (5 jobs)

```
0  3 * * *   ~/scripts/backup-postgresql.sh          # Backup DB
*  * * * *   ~/projects/pymepilot/backend/scripts/... # Upload worker
30 4 * * *   ~/projects/pymepilot/backend/scripts/... # Google Drive sync
0  5 * * *   flock ... ~/projects/pymepilot/backend/main.py  # Orquestador
30 5 * * *   ~/projects/pymepilot/backend/scripts/... # Freshness check
```

### 7.5 Backups

- **Automatico:** PostgreSQL dump diario 3 AM
- **Directorio:** `~/backups/postgresql/`
- **Retencion:** 7 dias
- **Restauracion:** `~/scripts/restore-postgresql.sh`

---

## 8. Base de Datos

### 8.1 Tablas Principales

| Tabla | Funcion | RLS |
|-------|---------|-----|
| tenants | Distribuidores registrados | No (acceso via VIEW) |
| user_profiles | Usuarios del dashboard | Si |
| customers | Clientes de cada distribuidor | Si |
| products | Catalogo de productos | Si |
| orders | Cabecera de ordenes de venta | Si |
| order_items | Detalle de cada orden | Si |
| predictions | Predicciones generadas por el motor | Si |
| sync_log | Registro de sincronizaciones | Si |
| upload_jobs | Uploads pendientes/procesados | Si |
| notifications | Notificaciones del dashboard | Si |
| orchestrator_runs | Ejecuciones del orquestador | Si |
| api_usage | Tokens y costos Claude (global) | No |

### 8.2 Materialized Views

| MV | Funcion | Refresh |
|----|---------|---------|
| co_purchases | Pares de productos comprados juntos | Semanal (lunes, orquestador) |
| client_rankings | Ranking de clientes por facturacion | Semanal (lunes, orquestador) |

### 8.3 RPCs (funciones SQL)

| RPC | Retorna |
|-----|---------|
| get_monthly_revenue_split | Facturacion mensual: total, recurrente, nueva |
| get_monthly_churn | Tasa de churn mensual |
| get_monthly_ticket | Ticket promedio recurrente vs nuevo |
| get_monthly_value | Valor atribuido a predicciones convertidas |
| get_top_products | Productos mas vendidos |
| get_client_trends | Tendencia por cliente (up/down/stable) |
| get_client_monthly_revenue | Facturacion mensual de un cliente |
| refresh_materialized_views | Refresh de co_purchases + client_rankings |

### 8.4 Migraciones

57 migraciones + 57 rollbacks en `database/migrations/`. La migracion 057 agrega `segment` y `active_modules` a `tenants` para soportar activacion por modulo y evolucion futura por segmentos.

---

## 9. Control de Costos Claude API

4 capas obligatorias que no se pueden saltear:

```
Llamada a Claude
  │
  ├── Capa 1: Limite diario
  │   └── tokens_total_hoy >= DAILY_TOKEN_LIMIT (default 100k) → BLOQUEA
  │
  ├── Capa 2: Limite por llamada
  │   └── max_tokens <= MAX_TOKENS_PER_CALL (default 4k)
  │
  ├── Capa 3: Registro post-llamada (bloque finally)
  │   └── INSERT INTO api_usage (tokens_in, tokens_out, cost_usd, ...)
  │
  └── Capa 4: Alertas por log
      ├── WARNING >70% del limite diario
      └── CRITICAL >90% del limite diario
```

**Costos reales observados:**
- V2 Reposicion: ~$0.003 por candidato
- V3 Cross-Sell: ~$0.011 por ejecucion (5 candidatos)
- Smart Upload: ~$0.009 por archivo
- IEY produccion estimada: ~$1.50-2.00/mes

---

## 10. Decisiones Arquitectonicas Clave

| Decision | Alternativa descartada | Razon |
|----------|----------------------|-------|
| tenant_id + RLS | Schema per tenant | Mas simple, menos overhead, suficiente para <100 tenants |
| Python motor + Next.js dashboard | Todo en Next.js | Python mejor para data processing, Next.js mejor para UI |
| Claude Sonnet (no Opus) | Claude Opus | Costo 10x menor, calidad suficiente para mensajes comerciales |
| Supabase self-hosted | Supabase cloud | Ya corriendo en el VPS, control total, sin costos recurrentes |
| PostgREST (auto-REST) | API custom | Zero boilerplate, RLS da seguridad gratis, RPCs para logica compleja |
| Prompts en .txt | Prompts hardcoded | Editables sin deploy, versionables en git |
| 1 llamada Claude por candidato | Batch de candidatos | Mejor calidad de mensaje, aislamiento de errores |
| wa.me deep link | Kommo CRM API | Ningun PyME argentino tiene CRM, deep link funciona sin setup |
| Fernet para credenciales | Vault, KMS | Suficiente para MVP, sin dependencias externas |
| Crontab | Systemd timers, Celery | Simple, probado, suficiente para 1 ejecucion diaria |
