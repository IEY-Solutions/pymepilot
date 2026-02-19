# PymePilot - Roadmap de Desarrollo

**Version:** 1.0
**Fecha:** 2026-02-19
**Duracion estimada:** 22 semanas (5.5 meses)

---

## Vision General

```
Sem 1     Sem 2-3      Sem 4-5        Sem 6-8       Sem 9
  |          |            |              |             |
  v          v            v              v             v
[SETUP] -> [ERP] -> [MOTOR V2] -> [DASHBOARD] -> [AUTO]
  DB      Conector   Predicciones    Next.js       Cron
  Git    Contabilium  Reposicion     Login        Diario
  Python  + Excel     + Claude AI    KPIs

                                              HITO MVP -->
                                              Sistema funcionando
                                              para IEY sin
                                              intervencion manual

Sem 10-12   Sem 13-14    Sem 15-17     Sem 18-20    Sem 21-22
    |           |            |             |             |
    v           v            v             v             v
 [V1+V4]  -> [WHATSAPP] -> [V3+KPI] -> [MULTI] -> [PRODUCCION]
Activacion   Kommo CRM   Cross-Sell   2do tenant   Monitoreo
Recuperacion  Envio msg   Graficos    Onboarding   Seguridad
```

---

## Fase 0: Fundacion y Setup

**Duracion:** Semana 1
**Objetivo:** Tener el proyecto inicializado y la base de datos lista.

### Entregable
Repositorio Git inicializado, base de datos con todas las tablas creadas, primer tenant (IEY) registrado, y un script Python que se conecta exitosamente a la DB.

### Tareas

#### 0.1 Inicializar repositorio Git
- Crear `.gitignore` para Python, Node.js, y archivos sensibles
- Primer commit con estructura de carpetas
- **Concepto:** Git es el sistema de control de versiones. Cada cambio queda registrado y se puede volver atras si algo sale mal.

#### 0.2 Crear estructura de carpetas
```
pymepilot/
  backend/
    engine/
      verticales/       # Logica de cada vertical (V1, V2, V3, V4)
      claude/            # Comunicacion con Claude API
      db/                # Comunicacion con PostgreSQL
      connectors/        # Conectores a ERPs (Contabilium, Excel)
      core/              # Utilidades compartidas (logger, etc.)
    config/
      settings.py        # Configuracion del sistema
      prompts/           # Textos que se le envian a Claude por vertical
    scripts/             # Comandos ejecutables (sync, run vertical)
    tests/               # Tests automatizados
    main.py              # Punto de entrada principal
    requirements.txt     # Dependencias de Python
  database/
    migrations/          # Scripts SQL para crear/modificar tablas
    seed/                # Datos de prueba
  frontend/              # Dashboard web (se crea en Fase 3)
  scripts/               # Scripts de operaciones del servidor
  docs/                  # Documentacion (PRD, Roadmap, etc.)
```

#### 0.3 Crear migraciones de base de datos
Cada migracion es un archivo SQL que crea o modifica tablas. Tienen rollback (vuelta atras) por si algo sale mal.

| Migracion | Que crea | Detalle |
|---|---|---|
| `001_setup_extensions.sql` | Extensiones PostgreSQL | uuid-ossp (generar IDs unicos), pgcrypto (encriptacion) |
| `002_create_tenants.sql` | Tabla `tenants` | Registro de cada distribuidor, incluye tipo de ERP y config |
| `003_create_user_profiles.sql` | Tabla `user_profiles` | Usuarios del dashboard con rol y tenant asignado |
| `004_create_customers.sql` | Tabla `customers` | Clientes de cada distribuidor con datos de contacto |
| `005_create_products.sql` | Tabla `products` | Catalogo de productos de cada distribuidor |
| `006_create_orders.sql` | Tablas `orders` + `order_items` | Historial de compras (cabecera + detalle) |
| `007_create_predictions.sql` | Tabla `predictions` | Predicciones generadas por el motor |
| `008_create_sync_log.sql` | Tabla `sync_log` | Registro de cada sincronizacion con el ERP |
| `009_create_indexes.sql` | Indices de rendimiento | Aceleran las consultas mas frecuentes |
| `010_helper_functions.sql` | Funciones auxiliares | updated_at automatico, set_tenant_context |

**Concepto:** Las migraciones son la forma profesional de gestionar cambios en la base de datos. En vez de modificar tablas a mano, escribimos scripts SQL que se ejecutan en orden y se pueden revertir.

#### 0.4 Ejecutar migraciones y crear tenant IEY
- Ejecutar cada migracion contra PostgreSQL (que ya esta corriendo en Docker)
- Insertar IEY como primer tenant con `erp_type = 'contabilium'`

#### 0.5 Setup del entorno Python
- Crear `requirements.txt` con dependencias
- Crear virtual environment (entorno aislado de Python)
- Crear `.env.example` como template de variables de entorno

#### 0.6 Script de conexion a la base de datos
- Implementar `backend/engine/db/connection.py`
- Connection pooling (reutilizar conexiones para mayor rendimiento)
- Tenant context automatico (cada query sabe de que tenant es)

### Verificacion
```bash
# Conectar a la DB y verificar que existen las tablas
python -c "from engine.db.connection import get_db_connection; print('Conexion OK')"

# Verificar que el tenant IEY existe
# SELECT * FROM tenants WHERE slug = 'iey';
```

### Dependencias
- Docker stack de Supabase corriendo (ya existe)
- Python 3.11+ instalado en el servidor

---

## Fase 1: Conectores ERP + Carga de Datos IEY

**Duracion:** Semanas 2-3
**Objetivo:** Conectar PymePilot al ERP de IEY y sincronizar datos automaticamente.

### Entregable
Conector de Contabilium funcionando, datos reales de IEY (clientes, productos, ordenes) sincronizados en PostgreSQL, y un conector de Excel como alternativa.

### Arquitectura de conectores

```
                    ERPConnector (clase abstracta)
                    Define QUE datos necesitamos
                   /              |              \
                  /               |               \
  ContabiliumConnector    ExcelConnector    [Futuro: XubioConnector]
  Sabe COMO obtenerlos    Sabe COMO leer    Cada nuevo ERP es
  de la API de            un archivo         un nuevo conector
  Contabilium             Excel/CSV
```

**Concepto:** Una "clase abstracta" es como un formulario en blanco que dice "aca va el nombre, aca va el telefono" pero no tiene datos. Cada conector concreto (Contabilium, Excel) "llena el formulario" con su propia logica de como obtener esos datos. Esto nos permite agregar nuevos ERPs sin tocar el resto del sistema.

### Tareas

#### 1.1 Investigar API de Contabilium
- Conectarse con las credenciales de IEY
- Documentar endpoints disponibles (clientes, productos, ventas)
- Entender autenticacion y rate limits
- Crear `docs/CONTABILIUM_API.md` con hallazgos

#### 1.2 Implementar clase abstracta ERPConnector
- `backend/engine/connectors/base.py`
- Metodos: `authenticate()`, `fetch_customers()`, `fetch_products()`, `fetch_orders(since_date)`, `test_connection()`

#### 1.3 Implementar ContabiliumConnector
- `backend/engine/connectors/contabilium.py`
- Autenticacion con API de Contabilium
- Mapeo de datos (traducir formato de Contabilium al formato interno de PymePilot)
- Manejo de paginacion (cuando hay muchos datos, vienen en "paginas")
- Retry logic (si la API falla, reintentar automaticamente)

#### 1.4 Implementar ExcelConnector (fallback)
- `backend/engine/connectors/excel.py`
- Lee archivos .xlsx o .csv
- Valida que las columnas requeridas existan
- Mapea al formato interno

#### 1.5 Implementar motor de sincronizacion
- `backend/engine/connectors/sync.py`
- Detecta registros nuevos vs actualizados (upsert)
- Registra cada sync en tabla `sync_log` (fecha, cantidad de registros, errores)
- Calcula campos derivados post-sync

#### 1.6 Script CLI para sincronizar
- `backend/scripts/sync_erp.py --tenant-slug iey`
- Ejecutable desde la terminal

#### 1.7 Primera sincronizacion real con IEY
- Ejecutar sync completo
- Verificar datos en la DB

#### 1.8 Datos de prueba para desarrollo
- `database/seed/dev_data.sql`
- 20 clientes ficticios, 10 productos, 100 ordenes

### Verificacion
```bash
# Ejecutar sync
python scripts/sync_erp.py --tenant-slug iey

# Verificar en DB
# SELECT COUNT(*) FROM customers WHERE tenant_id = '...';
# SELECT COUNT(*) FROM orders WHERE tenant_id = '...';
# SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 1;
```

### Dependencias
- Credenciales de API de Contabilium de IEY
- Fase 0 completada (DB lista, tenant creado)

---

## Fase 2: Motor Inteligente - V2 Reposicion Predictiva

**Duracion:** Semanas 4-5
**Objetivo:** Analizar datos de IEY, detectar clientes que necesitan reponer, y generar mensajes personalizados.

### Entregable
Script que genera predicciones de reposicion para clientes de IEY, con mensajes personalizados, y las guarda en la tabla `predictions`.

### Como funciona el motor

```
1. LEER DATOS           2. CALCULAR              3. GENERAR MENSAJE
   Del PostgreSQL           Frecuencia               Con Claude API
   (clientes +              de compra                 (personalizado)
    ordenes)                 por producto

[customers] ----+      +---> Promedio dias     +---> "Hola Juan,
[orders]    ----|----->|     entre compras  --->|     hace 23 dias..."
[products]  ----+      +---> Fecha estimada    +---> Prioridad: ALTA
                              proxima compra          Confianza: 0.85

                                                  4. GUARDAR
                                                     En tabla predictions
                                                     Para que el dashboard
                                                     lo muestre
```

### Tareas

#### 2.1 Implementar VerticalBase (clase abstracta)
- `backend/engine/verticales/base.py`
- Define el flujo que TODA vertical sigue: obtener candidatos -> construir prompt -> generar mensaje -> guardar prediccion
- **Concepto:** Es el "molde" de todas las verticales. Cada vertical concreta (V1, V2, V3, V4) personaliza partes especificas pero el flujo general es el mismo.

#### 2.2 Implementar ClaudeClient
- `backend/engine/claude/client.py`
- Se comunica con la API de Anthropic (Claude)
- Retry logic (si falla, reintenta)
- Tracking de tokens consumidos (para controlar costos)
- Modelo por defecto: Claude Sonnet (balance costo/calidad)

#### 2.3 Implementar queries de base de datos
- `backend/engine/db/queries.py`
- Consultas SQL optimizadas para obtener candidatos de cada vertical

#### 2.4 Implementar logica de frecuencia de compra
La matematica detras de la prediccion:
- **Promedio:** Si Juan compro 5 veces con intervalos de 25, 30, 28, 32 dias -> promedio = 28.75 dias
- **Varianza:** Que tan regular es. Baja varianza = patron predecible. Alta varianza = dificil de predecir.
- **Fecha estimada:** Ultima compra + promedio de dias = fecha estimada de proxima compra
- **Ventana de contacto:** 7-14 dias antes de la fecha estimada

#### 2.5 Implementar VerticalReposicion
- `backend/engine/verticales/reposicion.py`
- Candidatos: clientes cuya proxima compra estimada cae en los proximos 7-14 dias
- Prompt: incluye nombre del cliente, productos TOP, frecuencia, para que Claude genere mensaje personalizado
- Confianza: basada en regularidad del patron y cantidad de datos disponibles

#### 2.6 Implementar logging
- `backend/engine/core/logger.py`
- Registro de cada operacion en formato JSON
- Util para debuggear problemas y medir rendimiento

#### 2.7 Script CLI para ejecutar vertical
- `backend/scripts/run_vertical.py --tenant-slug iey --vertical reposicion --limit 5`

#### 2.8 Testing con datos reales
- Ejecutar con limite de 5 clientes primero
- Revisar predicciones con el equipo de IEY
- Iterar prompts segun feedback

### Verificacion
```bash
python scripts/run_vertical.py --tenant-slug iey --vertical reposicion --limit 5

# Ver predicciones generadas
# SELECT customer_id, confidence_score, LEFT(message_text, 100)
# FROM predictions WHERE vertical = 'reposicion'
# ORDER BY created_at DESC LIMIT 5;
```

### Dependencias
- Fase 1 completada (datos de IEY cargados)
- API key de Anthropic configurada

---

## Fase 3: Dashboard MVP

**Duracion:** Semanas 6-8
**Objetivo:** Un dashboard web donde el vendedor ve la lista de clientes a contactar con mensajes sugeridos.

### Entregable
Aplicacion Next.js con login, vista de "Contactar Hoy" optimizada para celular, historial, y estado del sync.

### Tareas

#### 3.1 Inicializar proyecto Next.js
- `frontend/` con Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui
- **Concepto:** Next.js es un framework para crear aplicaciones web. TypeScript agrega "tipos" al codigo (como decir "esto es un numero, esto es texto") para evitar errores. Tailwind es un sistema de estilos. shadcn/ui son componentes visuales pre-hechos (botones, tarjetas, etc.).

#### 3.2 Implementar autenticacion
- Login con email y password via Supabase Auth
- El tenant_id del usuario se almacena en el JWT (token de sesion)
- Middleware que protege rutas: si no estas logueado, te redirige al login
- Crear usuario de prueba para IEY

#### 3.3 Pagina principal (dashboard home)
- Cards con KPIs basicos: clientes activos, predicciones pendientes, tasa de contacto
- Estado de la ultima sincronizacion

#### 3.4 Pagina "Contactar Hoy" (la mas importante)
- Lista de predicciones pendientes para hoy
- Cada tarjeta muestra:
  - Nombre del cliente
  - Productos que necesita reponer
  - Mensaje sugerido (boton para copiar al portapapeles)
  - Score de confianza (indicador visual)
  - Botones: "Contactado" / "Posponer" / "Ignorar"
- Ordenado por prioridad
- **Diseño mobile-first** (el vendedor usa celular)

#### 3.5 API routes (endpoints del backend web)
- GET /api/predictions — obtener predicciones pendientes
- PATCH /api/predictions/[id] — marcar como contactado/ignorado
- GET /api/kpis — obtener metricas basicas
- GET /api/sync-status — estado de la ultima sincronizacion

#### 3.6 Pagina de historial
- Lista de predicciones pasadas
- Filtros por fecha, estado, cliente

#### 3.7 Pagina "Estado de Datos"
- Muestra ultima sincronizacion exitosa
- Cantidad de registros por tabla
- Salud de la conexion con el ERP
- Proxima sincronizacion programada

#### 3.8 Layout y navegacion
- Sidebar en desktop, bottom navigation en celular
- Header con logo, nombre del tenant, boton de logout

### Verificacion
1. Login como vendedor de IEY
2. Ver lista "Contactar Hoy" con predicciones reales
3. Copiar mensaje sugerido
4. Marcar como contactado
5. Verificar que el estado cambia en la DB
6. Probar desde celular

### Dependencias
- Fase 2 completada (predicciones generadas)
- Supabase Auth configurado

---

## Fase 4: Automatizacion

**Duracion:** Semana 9
**Objetivo:** Todo funciona automaticamente cada dia sin intervencion manual.

### Entregable
Cada manana: datos se sincronizan del ERP a las 5 AM, motor genera predicciones a las 6 AM, vendedor abre dashboard a las 8 AM y todo esta listo.

### Tareas

#### 4.1 Orquestador principal
- `backend/main.py`
- Flujo diario:
  1. 5:00 AM — Sincronizar datos de todos los tenants activos
  2. 6:00 AM — Ejecutar verticales activas para cada tenant
- Si un tenant falla, sigue con el siguiente (no se frena todo)
- Log completo de cada ejecucion

#### 4.2 Configurar servicio automatico
- Crontab o systemd timer en el servidor
- Ejecuta `main.py` todos los dias a las 5 AM (horario Argentina)

#### 4.3 Indicadores en el dashboard
- "Ultima actualizacion: hoy 6:00 AM"
- Alerta visual si no se actualizo en >24 horas (algo fallo)

### Verificacion
1. Dejar correr una noche completa
2. Al dia siguiente, verificar:
   - sync_log tiene un registro nuevo de hoy
   - predictions tiene predicciones nuevas de hoy
   - Dashboard muestra datos actualizados

### Dependencias
- Fases 0-3 completadas

---

## HITO MVP (Semana 9)

> **El sistema funciona para IEY sin intervencion manual.**
>
> Cada manana: datos se sincronizan automaticamente desde Contabilium ->
> motor analiza y genera predicciones -> vendedor abre dashboard y ve
> la lista de clientes a contactar hoy con mensajes personalizados.

Este es el momento de validar con el equipo de IEY:
- Son utiles las predicciones?
- Los mensajes sugeridos son buenos?
- Que mejorar?

---

## Fase 5: Verticales 1 y 4

**Duracion:** Semanas 10-12
**Objetivo:** Agregar seguimiento de clientes nuevos y recuperacion de inactivos.

### Tareas principales
- Implementar `VerticalActivacion` (V1) con secuencia dia 7/15/25
- Implementar `VerticalRecuperacion` (V4) con ventanas 60/90/120 dias
- Crear vistas en el dashboard para cada vertical
- Vista unificada "Todas las acciones de hoy" (combina V1 + V2 + V4)
- Navegacion entre verticales (tabs o sidebar)
- Testing con datos reales de IEY

---

## Fase 6: Integracion WhatsApp/Kommo

**Duracion:** Semanas 13-14
**Objetivo:** Enviar mensajes por WhatsApp directamente desde el dashboard.

### Tareas principales
- Investigar Kommo CRM API (autenticacion OAuth 2.0, endpoints)
- Implementar conector WhatsApp via Kommo
- Boton "Enviar por WhatsApp" en cada tarjeta de prediccion
- Confirmacion antes de enviar
- Tracking de estado: enviado -> entregado -> leido
- Fallback: deep link a `wa.me/` si Kommo no esta configurado

---

## Fase 7: Vertical 3 + KPIs Avanzados

**Duracion:** Semanas 15-17
**Objetivo:** Agregar Cross-Sell y metricas avanzadas de valor generado.

### Tareas principales
- Implementar `VerticalCrossSell` (V3)
- Dashboard de KPIs avanzados:
  - Facturacion recurrente vs nueva (% y tendencia)
  - Tasa de churn mensual
  - Ticket promedio (recurrente vs nuevo)
  - Valor generado por PymePilot (facturacion atribuible a predicciones)
- Graficos interactivos
- Reportes exportables (PDF/Excel)

---

## Fase 8: Multi-Tenant Productivo

**Duracion:** Semanas 18-20
**Objetivo:** El sistema esta listo para recibir un segundo distribuidor.

### Tareas principales
- Script automatizado de onboarding: crear tenant + configurar ERP + usuario admin
- Pagina de configuracion de conector ERP en dashboard (admin conecta su propio ERP)
- Upload de Excel como alternativa para clientes sin ERP
- Testing exhaustivo de aislamiento entre tenants (tenant A no puede ver datos de tenant B)
- Documentacion de proceso de onboarding

---

## Fase 9: Pulido y Produccion

**Duracion:** Semanas 21-22
**Objetivo:** Sistema estable, monitoreado, seguro, y documentado.

### Tareas principales
- Monitoreo con Grafana: predicciones/dia, tokens consumidos, syncs exitosos/fallidos
- Auditoria de seguridad completa
- Optimizacion de rendimiento (queries lentas, indexes)
- Documentacion final (arquitectura, API, operaciones)

---

## Resumen de Hitos

| Semana | Hito | Que se puede hacer |
|---|---|---|
| 1 | Setup completo | DB lista, Python conecta, tenant IEY creado |
| 3 | Datos sincronizados | Datos de IEY cargados desde Contabilium automaticamente |
| 5 | Motor funcionando | Predicciones de reposicion generadas para clientes de IEY |
| 8 | Dashboard operativo | Vendedor puede ver y actuar sobre predicciones desde el celular |
| **9** | **MVP COMPLETO** | **Todo funciona automaticamente para IEY** |
| 12 | 3 verticales activas | Activacion + Reposicion + Recuperacion operativas |
| 14 | WhatsApp integrado | Mensajes se envian directamente desde el dashboard |
| 17 | 4 verticales + KPIs | Sistema completo con metricas de valor |
| 20 | Multi-tenant | Listo para segundo cliente |
| 22 | Produccion | Sistema estable, seguro, monitoreado |
