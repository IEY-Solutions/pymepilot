# 🛡️ CLAUDE CODE - MANUAL DE SEGURIDAD Y CONTEXTO DEL PROYECTO

**Proyecto:** PymePilot - Sistema de Seguimiento Inteligente para Distribuidores B2B
**Servidor:** Contabo VPS (Producción)
**Usuario:** pato
**Última actualización:** 2026-02-19
**Directorio del proyecto:** `/home/pato/projects/pymepilot/`

---

# 🎓 MODO EDUCATIVO

**IMPORTANTE:** Pato está aprendiendo a programar (1-2 hs/día). En CADA interacción:
- Explicar QUÉ se va a hacer antes de hacerlo
- Explicar POR QUÉ se hace (la razón de negocio o técnica)
- Explicar QUÉ CONCEPTO de programación involucra (en términos simples)
- Usar analogías del mundo real cuando sea posible
- No asumir conocimiento previo de programación

---

# 🔴 SECCIÓN 1: REGLAS DE SEGURIDAD CRÍTICAS

## ⛔ ARCHIVOS PROHIBIDOS - NUNCA LEER NI MODIFICAR

Claude Code **NO** tiene permiso para leer, modificar o mostrar el contenido de estos archivos bajo **NINGUNA** circunstancia:

### **Credenciales y Secrets:**
- `.env` y `.env.*` (todas las variantes: .env.local, .env.production, .env.development)
- `*.credentials.json`
- `*secret*.json`, `*secrets*.yaml`
- `*.key`, `*.pem`, `*.crt` (certificados y claves privadas)
- `~/.ssh/*` (claves SSH)
- `/etc/ssl/private/*` (certificados privados)
- Cualquier archivo que contenga: API keys, tokens, passwords, JWT secrets

### **Archivos de Sistema Críticos:**
- `/etc/passwd`, `/etc/shadow`, `/etc/group`
- `/etc/ssh/sshd_config` (solo lectura permitida, NUNCA modificar)
- Archivos de configuración de firewall (UFW, iptables)
- Archivos de fail2ban

### **Datos Sensibles de Clientes:**
- Cualquier archivo en `~/backups/postgresql/` (backups de base de datos)
- Dumps de bases de datos (*.sql, *.sql.gz)
- Archivos con datos personales de clientes (nombres, emails, teléfonos, facturas)

---

## 🔒 DEBUGGING SEGURO - Cómo Manejar Archivos Sensibles

### **SI NECESITO DEBUGGEAR ARCHIVOS SENSIBLES:**

#### ❌ **NUNCA HAGAS ESTO:**
```bash
cat .env
echo $DATABASE_URL
docker exec postgres psql -c "SELECT * FROM users;"
```

#### ✅ **SIEMPRE HACÉ ESTO:**
```bash
# Validar estructura SIN mostrar valores
cat .env | sed 's/=.*/=***REDACTED***/g'

# Ver variables de entorno sin valores
env | grep -E "API|KEY|SECRET|PASSWORD|TOKEN" | sed 's/=.*/=***REDACTED***/'

# Contar registros sin mostrar datos
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"
```

### **ANTES de Leer Archivos en Estos Directorios, SIEMPRE Preguntame:**
- `/home/pato/*/config/`
- `/home/pato/*/.env*`
- Cualquier directorio con nombres: "credentials", "secrets", "keys", "private"

---

## 📝 LOGS - Qué Puedo y No Puedo Ver

### ✅ **Logs PERMITIDOS:**
- Logs de aplicación: `/var/log/syslog`, `/var/log/auth.log`
- Logs de Docker: `docker logs [container_name]`
- Logs de Nginx/Traefik (sin headers de autenticación)
- Logs de backups: `~/backups/backup.log`, `~/backups/backup-cron.log`

### ❌ **NUNCA Incluir en Respuestas:**
- API keys visibles en logs
- Tokens de autenticación
- Passwords (aunque estén hasheados)
- JWT secrets
- URLs completas con tokens en query params

### 🔍 **Si un Log Contiene Info Sensible:**
```bash
# Filtrar y mostrar solo errores sin credenciales
docker logs orion-menteax_postgres 2>&1 | grep -i error | sed 's/password[=:][^ ]*/password=***REDACTED***/gi'
```

---

## 🚨 OPERACIONES DE ALTO RIESGO - SIEMPRE Confirmar con el Usuario

### **ANTES de Ejecutar Cualquiera de Estas Operaciones, PREGUNTAME:**

#### **Base de Datos:**
- `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`
- `DELETE FROM` sin `WHERE` (eliminación masiva)
- `ALTER TABLE` que modifique estructura existente
- Modificar schemas de producción
- Cambiar passwords de PostgreSQL

#### **Docker:**
- `docker rm` (eliminar containers)
- `docker volume rm` (eliminar volúmenes con datos)
- `docker-compose down -v` (elimina volúmenes)
- Modificar `docker-compose.yml` en producción

#### **Archivos de Sistema:**
- Modificar `/etc/ssh/sshd_config`
- Cambios en firewall (UFW rules)
- Modificar configuración de fail2ban
- Cambiar permisos de archivos en `/etc/`

#### **Comandos Destructivos:**
- `rm -rf` en CUALQUIER directorio
- `chmod 777` en archivos sensibles
- `chown` que cambie propietario de archivos críticos

### **Formato de Confirmación Requerido:**
```
⚠️ OPERACIÓN DE ALTO RIESGO DETECTADA

Comando a ejecutar:
[comando exacto]

Qué hace:
[explicación en lenguaje simple]

Riesgos:
[qué puede salir mal]

¿Proceder? (sí/no):
```

**Solo ejecutar si el usuario responde explícitamente "sí".**

---

## 🔐 SEGURIDAD EN MULTI-TENANT - CRÍTICO

### **REGLAS INQUEBRANTABLES:**

1. **Aislamiento de Datos por Tenant:**
   - CADA cliente (tenant) tiene su propio schema PostgreSQL
   - **NUNCA** mezclar datos de diferentes tenants en la misma query
   - **SIEMPRE** usar Row Level Security (RLS) en Supabase

2. **Verificar Tenant en TODAS las Operaciones:**
```sql
   -- ❌ INCORRECTO (sin filtro de tenant, ve datos de TODOS)
   SELECT * FROM customers;

   -- ✅ CORRECTO (filtrar por tenant_id, o depender de RLS)
   SELECT * FROM customers WHERE tenant_id = 'uuid-del-tenant-iey';
   -- Con RLS activo, el filtro es automático según el usuario logueado
```

3. **Testing de Aislamiento:**
   - Antes de deploy, verificar que usuario de tenant_A NO puede ver datos de tenant_B
   - Probar RLS policies con diferentes usuarios

4. **Secrets por Tenant:**
   - Cada tenant puede tener sus propias API keys
   - NUNCA compartir secrets entre tenants
   - Almacenar en variables de entorno con prefijo: `TENANT_[nombre]_[secret]`

---

## 🔑 MANEJO DE SECRETS - Variables de Entorno

### **Dónde Buscar Secrets (en orden de prioridad):**

1. **Variables de entorno del sistema:**
```bash
   echo $ANTHROPIC_API_KEY  # ❌ NO mostrar valor
   env | grep ANTHROPIC     # ❌ NO mostrar valor
```

2. **Archivos .env (NUNCA mostrar contenido):**
   - `~/projects/pymepilot/.env.production` (producción)
   - `~/projects/pymepilot/.env.development` (desarrollo)
   - Docker Compose env files

3. **Docker secrets (si están configurados):**
   - `docker secret ls`

### **Cómo Validar que un Secret Existe SIN Mostrarlo:**
```bash
# ✅ CORRECTO - Valida sin mostrar valor
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY no está configurada"
else
  echo "✅ ANTHROPIC_API_KEY configurada (${#ANTHROPIC_API_KEY} caracteres)"
fi
```

---

## 📦 BACKUPS - Información Crítica

### **Ubicación de Backups:**
- **PostgreSQL:** `~/backups/postgresql/`
- **Logs de backup:** `~/backups/backup.log`, `~/backups/backup-cron.log`

### **Scripts Disponibles:**
```bash
~/scripts/backup-postgresql.sh   # Backup manual
~/scripts/restore-postgresql.sh  # Restaurar desde backup
```

### **Programación:**
- Backup automático: **Todos los días a las 3:00 AM**
- Retención: **7 días** (backups más viejos se eliminan automáticamente)
- Compresión: `.sql.gz` (ahorra espacio)

### **ANTES de Operaciones Peligrosas:**
```bash
# SIEMPRE hacer backup manual antes de cambios críticos
~/scripts/backup-postgresql.sh
```

### **Cómo Verificar Backups SIN Mostrar Datos:**
```bash
# ✅ Ver lista de backups disponibles
ls -lh ~/backups/postgresql/

# ✅ Verificar tamaño del último backup
du -h ~/backups/postgresql/postgres_backup_*.sql.gz | tail -1

# ❌ NUNCA descomprimir y mostrar contenido
```

---

# 🎯 SECCIÓN 2: CONTEXTO DEL PROYECTO PYMEPILOT

## 📊 ¿Qué es PymePilot?

**PymePilot** es un sistema de Business Intelligence especializado para distribuidores mayoristas B2B en Argentina que analiza bases de datos existentes para decirle a los equipos comerciales:

- **A QUIÉN** contactar (cliente específico)
- **CUÁNDO** contactar (momento exacto según predicción)
- **QUÉ** ofrecer (productos basados en historial)

### **Caso de Éxito Validado:**
- **Cliente:** IEY (Distribuidor #1 de Accesorios MagSafe Argentina)
- **Resultados en 6 meses:**
  - % Facturación recurrente: **34% → 74%** (+114.8%)
  - Clientes perdidos/mes: **18% → 8%** (-56%)
  - Ticket promedio recurrente vs nuevo: **+88.4%**
  - Conversión nuevos → recurrentes: **30% → 68%** (+126%)

---

## 🏗️ LAS 4 VERTICALES DEL SISTEMA

### **VERTICAL 1: Activación de Clientes Nuevos**
**Objetivo:** Convertir cliente nuevo en recurrente antes de que se olvide de vos

**Qué hace:**
- Detecta clientes que hicieron su PRIMERA compra
- Genera secuencia de seguimiento automática (día 7, 15, 25)
- Alerta si NO recompra en 30 días
- Sugiere "segundo pedido" basado en primera compra

**Resultado esperado:**
- Conversión nuevos → recurrentes: +126% (30% → 68%)

---

### **VERTICAL 2: Reposición Predictiva** ⭐ (MÁS USADA EN IEY)
**Objetivo:** Contactar cliente ANTES de que se quede sin stock (antes que la competencia)

**Qué hace:**
- Aprende frecuencia de compra de CADA cliente (por producto/categoría)
- Calcula CUÁNDO va a necesitar reponer
- Avisa al equipo comercial **5-7 días ANTES**
- Genera propuesta de reposición con cantidades estimadas

**Resultado esperado:**
- 67% de clientes compran ANTES de quedarse sin stock
- Ticket promedio: +10-15%

---

### **VERTICAL 3: Cross-Sell Inteligente**
**Objetivo:** Que clientes recurrentes compren MÁS por pedido (productos complementarios)

**Qué hace:**
- Cruza historial de cada cliente con catálogo completo
- Detecta productos que NUNCA compró pero otros clientes SÍ
- Genera recomendaciones personalizadas
- Trackea aceptación para mejorar el modelo

**Resultado esperado:**
- Ticket promedio recurrente vs nuevo: +88%
- Incorporación de nuevas líneas = facturación recurrente de largo plazo

---

### **VERTICAL 4: Recuperación de Clientes Inactivos**
**Objetivo:** Reactivar clientes que dejaron de comprar antes de perderlos para siempre

**Qué hace:**
- Detecta clientes inactivos (60, 90, 120 días sin comprar)
- Clasifica por probabilidad de recuperación (score)
- Genera mensajes escalonados:
  - Día 60: Recordatorio amigable
  - Día 90: Oferta especial
  - Día 120: Última oportunidad
- Reporte mensual: recuperados vs perdidos definitivos

**Resultado esperado:**
- Reducción de pérdida: 18% → 8% (-56%)
- En IEY: 18 de 45 inactivos recuperados en 30 días

---

## 🔧 CÓMO FUNCIONA EL FLUJO COMPLETO
```
┌─────────────────────────────────────────┐
│ 1. INGESTA DE DATOS                     │
│ Cliente descarga historial de su ERP    │
│ (Contabilium, Excel, etc.)              │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 2. CARGA EN POSTGRESQL                  │
│ Upload vía Dashboard → Schema del tenant│
│ Tablas: customers, purchases, products  │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 3. MOTOR INTELIGENTE (Python + Claude)  │
│ Corre diario a las 6 AM                 │
│ - Lee datos históricos                  │
│ - Ejecuta vertical activa (ej: V1)      │
│ - Genera predicciones                   │
│ - Inserta en tabla predictions          │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 4. NOTIFICACIÓN WHATSAPP                │
│ Vía Kommo CRM API                       │
│ - Mensaje personalizado por cliente     │
│ - Enviado al vendedor asignado          │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 5. DASHBOARD (Next.js)                  │
│ - Vista "A quién contactar hoy"         │
│ - Histórico de contactos                │
│ - KPIs en tiempo real                   │
│ - Métricas de valor generado            │
└─────────────────────────────────────────┘
```

---

# 🏛️ SECCIÓN 3: ARQUITECTURA TÉCNICA

## 📐 STACK TECNOLÓGICO

### **Frontend:**
- **Next.js 14+** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui**
- **Deploy:** Vercel (o servidor Contabo con PM2)

### **Backend:**
- **Supabase** (self-hosted en Contabo)
  - PostgreSQL 15+
  - GoTrue (Auth multi-tenant)
  - PostgREST (API automática)
  - Row Level Security (RLS)
- **Traefik** (Reverse Proxy + SSL automático)

### **Motor Inteligente:**
- **Python 3.11+**
- **Anthropic Claude API** (generación de mensajes personalizados)
- **psycopg3** (conexión PostgreSQL con connection pooling)
- **Pandas** (análisis de datos)
- **Crontab/systemd** (ejecución diaria automatizada — NO usamos N8N)

### **Conectores ERP:**
- **Contabilium API REST** (primer conector — IEY)
- **Excel/CSV** (fallback para clientes sin ERP)
- Arquitectura de plugins para agregar más ERPs en el futuro

### **Integraciones:**
- **Kommo CRM API** (WhatsApp Business oficial — Fase 6)
- **Qdrant** (Vector DB para embeddings/RAG - futuro)

### **Infraestructura:**
- **Servidor:** Contabo VPS (12GB RAM, 193GB SSD)
- **Docker + Docker Compose** (stack en `/opt/orion-stack/`)
- **Backups:** Automáticos diarios (3 AM)
- **Monitoreo:** Grafana + Prometheus (ya corriendo)

---

## 🗂️ DISEÑO MULTI-TENANT (tenant_id + RLS)

> **DECISIÓN (2026-02-19):** Se usa `tenant_id` en cada tabla + Row Level Security (RLS),
> NO schema-per-tenant. Es más simple, escalable, y alineado con las mejores prácticas de Supabase.

### **Arquitectura de Base de Datos:**
```sql
-- Todas las tablas en el schema public con tenant_id

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- Nombre distribuidora (ej: "IEY")
  slug TEXT UNIQUE NOT NULL,        -- Identificador (ej: "iey")
  erp_type TEXT,                    -- Tipo de ERP: 'contabilium', 'excel', 'xubio', etc.
  erp_config JSONB DEFAULT '{}',   -- Configuración del conector ERP
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor', -- 'super_admin', 'admin', 'vendedor', 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_id TEXT,                 -- ID en el ERP del cliente
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  first_purchase_date DATE,
  last_purchase_date DATE,
  total_purchases_count INTEGER DEFAULT 0,
  total_purchases_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_id TEXT,                 -- SKU o ID en el ERP
  name TEXT NOT NULL,
  category TEXT,
  price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  external_id TEXT,                 -- ID de la orden en el ERP
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2),
  total_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vertical TEXT NOT NULL,           -- 'reposicion', 'activacion', 'cross_sell', 'recuperacion'
  prediction_date DATE NOT NULL,
  contact_date DATE,                -- Fecha recomendada de contacto
  message_text TEXT,                -- Mensaje sugerido para WhatsApp
  confidence_score DECIMAL(3,2),    -- 0.00 a 1.00
  priority INTEGER,                 -- 1 (alta) a 5 (baja)
  status TEXT DEFAULT 'pending',    -- 'pending', 'contacted', 'ignored', 'completed'
  metadata JSONB DEFAULT '{}',      -- Datos adicionales (productos sugeridos, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sync_type TEXT NOT NULL,          -- 'full', 'incremental'
  source TEXT NOT NULL,             -- 'contabilium', 'excel', etc.
  status TEXT NOT NULL,             -- 'started', 'completed', 'failed'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### **Row Level Security (RLS) - CRÍTICO:**
```sql
-- Habilitar RLS en TODAS las tablas con datos de tenant
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Policy genérica: usuario solo ve datos de SU tenant
-- Se aplica a todas las tablas con tenant_id
CREATE POLICY tenant_isolation ON customers
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );
-- Repetir para: products, orders, order_items, predictions, sync_log
```

---

## 📁 ESTRUCTURA DEL PROYECTO
```
/home/pato/projects/pymepilot/
│
├── backend/                          # Motor inteligente (Python)
│   ├── engine/
│   │   ├── verticales/               # Lógica de cada vertical
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Clase abstracta VerticalBase
│   │   │   ├── reposicion.py        # V2: Reposición Predictiva (MVP)
│   │   │   ├── activacion.py        # V1: Activación Clientes Nuevos
│   │   │   ├── cross_sell.py        # V3: Cross-Sell Inteligente
│   │   │   └── recuperacion.py      # V4: Recuperación Inactivos
│   │   ├── connectors/              # Conectores ERP (arquitectura de plugins)
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Clase abstracta ERPConnector
│   │   │   ├── contabilium.py       # Conector Contabilium API REST
│   │   │   ├── excel.py             # Conector Excel/CSV (fallback)
│   │   │   └── sync.py              # Motor de sincronización
│   │   ├── claude/                   # Cliente Anthropic API
│   │   │   ├── __init__.py
│   │   │   └── client.py            # ClaudeClient con retry logic
│   │   ├── db/                       # Conexión PostgreSQL
│   │   │   ├── __init__.py
│   │   │   ├── connection.py        # Connection pool con tenant context
│   │   │   └── queries.py           # Queries SQL parametrizadas
│   │   └── core/                     # Utilidades compartidas
│   │       ├── __init__.py
│   │       └── logger.py            # Logging estructurado JSON
│   ├── config/
│   │   ├── settings.py              # Configuración por tenant
│   │   └── prompts/                 # Prompts para Claude por vertical
│   │       ├── reposicion.txt
│   │       ├── activacion.txt
│   │       └── ...
│   ├── scripts/                     # Scripts CLI
│   │   ├── sync_erp.py              # Sincronizar datos del ERP
│   │   └── run_vertical.py          # Ejecutar vertical manualmente
│   ├── tests/
│   │   └── test_verticales.py
│   ├── main.py                      # Orquestador principal (sync + verticales)
│   └── requirements.txt
│
├── database/                         # Schema + Migrations PostgreSQL
│   ├── migrations/                  # Scripts SQL con rollback
│   │   ├── 001_setup_extensions.sql
│   │   ├── 001_rollback.sql
│   │   ├── 002_create_tenants.sql
│   │   └── ...
│   └── seed/
│       └── dev_data.sql             # Datos de prueba
│
├── frontend/                         # Dashboard (Next.js 14+ App Router)
│   └── (se inicializa en Fase 3)
│
├── scripts/                          # Scripts de operaciones del servidor
│   └── create-tenant.sh
│
├── docs/                             # Documentación
│   ├── PRD.md                       # Product Requirements Document
│   ├── ROADMAP.md                   # Roadmap de desarrollo
│   ├── CONTABILIUM_API.md           # Documentación de la API de Contabilium
│   └── FORMATO_INGESTA.md           # Formato de datos para Excel/CSV
│
├── .claude/                          # Configuración Claude Code
│   ├── agents/                      # 6 agentes especializados
│   ├── commands/                    # 36 skills técnicos
│   └── settings.local.json
│
├── CLAUDE.md                         # Este archivo
├── .env.example                      # Template de secrets
└── .gitignore
```

**Infraestructura Docker:** El stack de Supabase corre en `/opt/orion-stack/docker-compose.yml` (separado del código del proyecto).

---

# 🔄 SECCIÓN 4: WORKFLOWS DE DESARROLLO

## 🚀 Workflow Típico de Desarrollo

### **1. ANTES de Empezar Sesión de Claude Code:**
```bash
# SIEMPRE ejecutar esto primero
~/scripts/claude-safe.sh
```

### **2. Durante Desarrollo:**
- Claude Code trabaja en `/home/pato/projects/pymepilot/`
- Infraestructura Docker en `/opt/orion-stack/` (NO modificar sin confirmación)
- **NUNCA** tocar archivos de producción directamente
- Usar branches de Git para features nuevas
- Testing en ambiente local/dev primero
- **SIN N8N:** Toda automatización se construye en Python (crontab/systemd)

### **3. DESPUÉS de Sesión de Claude Code:**
```bash
# SIEMPRE ejecutar auditoría
~/scripts/claude-audit.sh
```

### **4. Antes de Deploy a Producción:**
```bash
# Backup manual
~/scripts/backup-postgresql.sh

# Verificar que tests pasen
# Verificar que no hay secrets hardcodeados
# Hacer deploy
```

---

## 📝 Creación de Nueva Vertical (Ejemplo)

### **Pasos:**
1. Crear migration SQL (si necesita tablas nuevas): `database/migrations/0XX_vertical_N.sql` + rollback
2. Crear clase Python que extiende VerticalBase: `backend/engine/verticales/nombre.py`
3. Crear prompt para Claude: `backend/config/prompts/nombre.txt`
4. Registrar vertical en el orquestador: `backend/main.py`
5. Crear vista en dashboard: `frontend/src/app/dashboard/nombre/page.tsx`
6. Testing con datos de IEY
7. Deploy gradual (activar para 1 tenant primero)

---

## 🧪 Testing de Aislamiento Multi-Tenant

### **ANTES de Lanzar a Producción, VERIFICAR:**
```sql
-- Test 1: Con RLS activo, usuario de tenant A NO ve datos de tenant B
-- (autenticado como usuario de IEY)
SELECT COUNT(*) FROM customers;
-- Debe retornar SOLO los clientes de IEY, no de otros tenants

-- Test 2: Query directa no puede cruzar tenants
-- (autenticado como usuario de IEY)
SELECT COUNT(*) FROM predictions p
JOIN customers c ON p.customer_id = c.id
WHERE c.tenant_id != (SELECT tenant_id FROM user_profiles WHERE id = auth.uid());
-- Debe retornar 0 (RLS bloquea el acceso)

-- Test 3: Sin RLS bypass, no hay leaks
SELECT DISTINCT tenant_id FROM customers;
-- Con RLS activo, solo debe mostrar UN tenant_id
```

---

# 🛠️ SECCIÓN 5: COMANDOS ÚTILES

## 🐘 PostgreSQL (Supabase)

### **Conectarse a PostgreSQL:**
```bash
# Desde el servidor (sin exponer puerto)
docker exec -it orion-menteax_postgres psql -U postgres

# Listar todas las databases
\l

# Listar schemas
\dn

# Cambiar a un schema específico
SET search_path TO tenant_iey;

# Ver tablas del schema actual
\dt

# Salir
\q
```

### **Crear Nuevo Tenant:**
```bash
# Script automatizado
~/projects/pymepilot/scripts/create-tenant.sh "nombre_distribuidora" "slug" "erp_type"

# Ejemplo:
~/projects/pymepilot/scripts/create-tenant.sh "Distribuidora XYZ" "xyz" "contabilium"
```

### **Queries Seguras (sin exponer datos):**
```bash
# ✅ Contar registros por tenant
docker exec orion-menteax_postgres psql -U postgres -d postgres \
  -c "SELECT t.slug, COUNT(c.id) FROM tenants t LEFT JOIN customers c ON c.tenant_id = t.id GROUP BY t.slug;"

# ✅ Ver estructura sin datos
docker exec orion-menteax_postgres psql -U postgres -d postgres \
  -c "\d customers"

# ❌ NUNCA hacer SELECT * sin redactar
```

---

## 🐳 Docker

### **Ver Logs de Containers:**
```bash
# PostgreSQL
docker logs orion-menteax_postgres --tail 50

# Supabase Auth
docker logs orion-menteax_auth --tail 50

# Filtrar errores (sin mostrar secrets)
docker logs orion-menteax_postgres 2>&1 | grep -i error | \
  sed 's/password[=:][^ ]*/password=***REDACTED***/gi'
```

### **Restart de Servicios:**
```bash
# Restart un container específico
docker restart orion-menteax_postgres

# Restart todo el stack
cd ~/[directorio-docker-compose]
docker-compose restart
```

---

## 📦 Backups

### **Backup Manual (antes de cambios críticos):**
```bash
~/scripts/backup-postgresql.sh
```

### **Ver Backups Disponibles:**
```bash
ls -lh ~/backups/postgresql/
```

### **Restaurar desde Backup:**
```bash
~/scripts/restore-postgresql.sh
# Sigue las instrucciones interactivas
```

### **Verificar Logs de Backups:**
```bash
tail -50 ~/backups/backup.log
tail -50 ~/backups/backup-cron.log
```

---

## 🔍 Monitoreo

### **Espacio en Disco:**
```bash
df -h | grep -E "Filesystem|/dev/sda|/$"
```

### **Uso de RAM:**
```bash
free -h
```

### **Containers Corriendo:**
```bash
docker ps
```

### **Verificar Firewall:**
```bash
sudo ufw status verbose
```

---

## 🔐 Seguridad

### **Verificar Permisos de Archivos Sensibles:**
```bash
# Ver permisos de .env (debe ser 600)
ls -la ~/projects/pymepilot/.env*

# Corregir permisos si es necesario
~/scripts/fix-permissions.sh
```

### **Ver Intentos de Login SSH Bloqueados:**
```bash
sudo fail2ban-client status sshd
```

---

# 📌 SECCIÓN 6: PRINCIPIOS DE CÓDIGO

## ✅ Buenas Prácticas

### **TypeScript/JavaScript:**
- **SIEMPRE** usar TypeScript strict mode
- **NUNCA** usar `any` (usar `unknown` si es necesario)
- Componentes React como funciones (no clases)
- Custom hooks para lógica reutilizable
- Validación de inputs con Zod

### **Python:**
- Type hints en TODAS las funciones
- Docstrings en formato Google
- Manejo de errores con try/except específicos
- Logging en vez de prints
- Virtual environment para dependencias

### **SQL:**
- **SIEMPRE** usar prepared statements (prevenir SQL injection)
- **NUNCA** concatenar strings para queries
- Indexes en columnas usadas en WHERE/JOIN
- EXPLAIN ANALYZE para queries lentas

### **Git:**
- Commits descriptivos (ej: "feat: Add Vertical 1 prediction logic")
- Branches por feature: `feature/vertical-1`, `fix/rls-policy`
- **NUNCA** commitear secrets (.env en .gitignore)
- Pull requests con descripción clara

---

## ❌ Anti-Patterns a Evitar

### **Seguridad:**
- ❌ Hardcodear API keys en código
- ❌ Logs con passwords/tokens visibles
- ❌ Queries SQL sin parámetros (concatenación de strings)
- ❌ Compartir secrets entre tenants

### **Arquitectura:**
- ❌ Código de Vertical X accediendo directamente a datos de Vertical Y
- ❌ Lógica de negocio en el frontend
- ❌ Queries N+1 (cargar datos en loops)
- ❌ Mezclar datos de diferentes tenants en la misma query

### **Performance:**
- ❌ SELECT * (cargar solo columnas necesarias)
- ❌ Falta de indexes en tablas grandes
- ❌ No usar paginación en listas
- ❌ Cargar todo el dataset en memoria (usar streaming)

---

# 🎯 SECCIÓN 7: CASOS DE USO COMUNES

## 1️⃣ Agregar Nuevo Cliente (Tenant)
```bash
# Paso 1: Crear schema y tablas
cd ~/projects/pymepilot/infra/scripts
./create-tenant.sh "Distribuidora ABC" "abc"

# Paso 2: Verificar que se creó correctamente
docker exec -it orion-menteax_postgres psql -U postgres -c "\dn"
# Debe aparecer: tenant_abc

# Paso 3: Crear usuario en dashboard (Next.js)
# (Flujo de registro en /dashboard/register)
```

---

## 2️⃣ Ejecutar Vertical Manualmente (Testing)
```bash
cd ~/projects/pymepilot/backend

# Activar virtual environment (si no está activo)
source venv/bin/activate

# Ejecutar Vertical 2 (Reposición) para tenant específico
python scripts/run_vertical.py --tenant-slug iey --vertical reposicion --limit 5

# Ver predicciones generadas (sin mostrar datos sensibles)
docker exec orion-menteax_postgres psql -U postgres -d postgres \
  -c "SELECT id, customer_id, vertical, confidence_score, status FROM predictions WHERE vertical = 'reposicion' ORDER BY created_at DESC LIMIT 10;"
```

---

## 3️⃣ Debuggear Por Qué No se Envió WhatsApp
```bash
# Paso 1: Verificar predicciones pendientes (sin mostrar datos sensibles)
docker exec orion-menteax_postgres psql -U postgres -d postgres \
  -c "SELECT id, customer_id, status, created_at FROM predictions WHERE status = 'pending' LIMIT 10;"

# Paso 2: Ver logs del motor
# Los logs están en formato JSON en stdout (capturados por systemd/cron)
journalctl -u pymepilot-engine --since "today" | grep -i whatsapp

# Paso 3: Verificar conexión con Kommo API (Fase 6+)
cd ~/projects/pymepilot/backend
python -c "from engine.core.whatsapp_sender import test_connection; test_connection()"
```

---

## 4️⃣ Migrar Database (Nueva Columna/Tabla)
```bash
# Paso 1: Crear migration + rollback files
cd ~/projects/pymepilot/database/migrations
# Ejemplo: 011_add_whatsapp_column.sql
# ALTER TABLE customers ADD COLUMN whatsapp TEXT;
# Y su rollback: 011_rollback.sql
# ALTER TABLE customers DROP COLUMN whatsapp;

# Paso 2: Ejecutar migration
docker exec -i orion-menteax_postgres psql -U postgres -d postgres < 011_add_whatsapp_column.sql

# Paso 3: Verificar
docker exec orion-menteax_postgres psql -U postgres -d postgres \
  -c "\d customers"
```

---

# 📞 SECCIÓN 8: CONTACTOS Y RECURSOS

## 🆘 En Caso de Emergencia

### **Si el Servidor se Cae:**
1. Verificar logs: `docker ps -a` (ver qué containers están stopped)
2. Restart stack: `cd [docker-compose-dir] && docker-compose restart`
3. Si PostgreSQL no levanta: Verificar logs → `docker logs orion-menteax_postgres`
4. Último recurso: Restaurar desde backup → `~/scripts/restore-postgresql.sh`

### **Si Backups Fallan:**
1. Ver logs: `tail -100 ~/backups/backup-cron.log`
2. Ejecutar manual para ver error: `~/scripts/backup-postgresql.sh`
3. Verificar espacio en disco: `df -h`

---

## 📚 Documentación Técnica

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **Anthropic API:** https://docs.anthropic.com/
- **Next.js App Router:** https://nextjs.org/docs/app
- **Kommo CRM API:** https://www.kommo.com/developers

---

## 🎓 Filosofía de Desarrollo

### **Seguridad Primero:**
- Backups ANTES de cambios críticos
- Testing de aislamiento multi-tenant
- Nunca exponer secrets

### **Simplicidad:**
- Código legible > Código "clever"
- Documentar decisiones arquitectónicas
- Si algo es complejo, probablemente está mal diseñado

### **Iteración Rápida:**
- MVP funcional > Solución perfecta
- Testear con IEY primero, después escalar
- Feedback de usuarios reales > Teoría

---

# ✅ CHECKLIST ANTES DE CADA SESIÓN
```bash
□ Ejecutar ~/scripts/claude-safe.sh
□ Verificar que estoy en la branch correcta (git branch)
□ Confirmar que backups están actualizados (ls -lh ~/backups/postgresql/)
□ Verificar espacio en disco (df -h)
□ Confirmar objetivo de la sesión (¿qué vamos a construir?)
```

---

# ✅ CHECKLIST DESPUÉS DE CADA SESIÓN
```bash
□ Ejecutar ~/scripts/claude-audit.sh
□ Commitear cambios con mensaje descriptivo
□ Verificar que no hay secrets hardcodeados (git diff)
□ Probar cambios en ambiente local/dev
□ Documentar decisiones importantes en docs/
```

---

**FIN DEL MANUAL - Última actualización: 2026-02-17**

---

# 📚 SECCIÓN: SKILLS Y AGENTES ESPECIALIZADOS

## 🤖 Sistema de Agentes Disponibles

Este proyecto tiene acceso a **6 agentes especializados** con **30 skills técnicos** documentados en `.claude/skills/`:

### **@security-guardian** 🛡️ (security/)
Auditor de seguridad que previene vulnerabilidades ANTES de producción.
- `security-audit-checklist.md` - Checklist pre-deploy completo
- `secret-detection.md` - Detección automática de secrets
- `rls-testing.md` - Testing de Row Level Security
- `multi-tenant-validation.md` - Validación de tenant isolation
- `claude-md-compliance.md` - Compliance de este archivo

### **@db-architect** 🗄️ (database/)
Arquitecto de PostgreSQL multi-tenant con foco en seguridad y performance.
- `postgresql-schemas.md` - Templates de tablas multi-tenant
- `multi-tenant-rls.md` - Row Level Security completo
- `migrations-seguras.md` - Sistema de rollback y zero-downtime
- `query-optimization.md` - EXPLAIN ANALYZE y optimización
- `tenant-isolation-testing.md` - Suite de testing de aislamiento

### **@supabase-backend** 🔧 (supabase/)
Especialista en Supabase BaaS (Auth, Edge Functions, Storage, Realtime).
- `supabase-auth-multi-tenant.md` - Auth con tenant_id en JWT
- `supabase-edge-functions.md` - Edge Functions con tenant context
- `supabase-storage.md` - Buckets con RLS y signed URLs
- `supabase-realtime.md` - Subscriptions con tenant filtering
- `supabase-client-setup.md` - Setup en Next.js

### **@python-engine** 🐍 (python/)
Python + Claude API + arquitectura de features de IA.
- `claude-api-integration.md` - Cliente Anthropic SDK completo
- `vertical-template.md` - Base class para features de IA
- `psycopg3-multi-tenant.md` - Connection pooling con tenant context
- `python-logging.md` - Logging estructurado JSON
- `prompt-engineering-verticales.md` - Optimización de prompts

### **@nextjs-dashboard** 🌐 (nextjs/)
Next.js 14+ con App Router, Server Actions, shadcn/ui.
- `nextjs-app-router.md` - Estructura completa App Router
- `server-actions.md` - Forms con mutations y validación
- `shadcn-ui-setup.md` - Instalación y customización
- `data-fetching-patterns.md` - Server/Client Components
- `responsive-design.md` - Breakpoints y mobile-first

### **@api-integrations** 🔗 (integrations/)
Integraciones con APIs externas (genérico - cualquier API).
- `oauth-authentication.md` - OAuth 2.0 completo
- `rest-api-patterns.md` - Consumo de REST APIs
- `webhook-architecture.md` - Receivers seguros con HMAC
- `api-resilience.md` - Circuit breaker y exponential backoff
- `data-transformation.md` - Schema mapping y validación

## 🎯 Cómo Invocar Agentes

**Formato recomendado:**
```
"Necesito [tarea específica]. Consultá con @[agente] usando el skill [nombre-skill]"
```

**Ejemplos:**
- "Voy a deployar a producción. Consultá @security-guardian con security-audit-checklist"
- "Tengo un query lento. Consultá @db-architect con query-optimization"
- "Voy a integrar API de WhatsApp. Consultá @api-integrations con webhook-architecture"

## 📍 Ubicación de Skills
```
pymepilot/.claude/skills/
├── security/      (6 archivos)
├── database/      (6 archivos)
├── supabase/      (6 archivos)
├── python/        (6 archivos)
├── nextjs/        (6 archivos)
└── integrations/  (6 archivos)
```

**TOTAL: 36 archivos .md (6 README + 30 skills)**

