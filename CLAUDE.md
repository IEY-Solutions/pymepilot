# CLAUDE CODE - MANUAL DE SEGURIDAD Y CONTEXTO

**Proyecto:** PymePilot - Seguimiento Inteligente para Distribuidores B2B
**Servidor:** Contabo VPS | **Usuario:** pato | **Directorio:** `/home/pato/projects/pymepilot/`
**Ultima actualizacion:** 2026-02-20

---

# MODO EDUCATIVO

Pato esta aprendiendo a programar (1-2 hs/dia). En CADA interaccion:
- Explicar QUE se va a hacer antes de hacerlo
- Explicar POR QUE se hace (razon de negocio o tecnica)
- Explicar QUE CONCEPTO de programacion involucra (en terminos simples)
- Usar analogias del mundo real cuando sea posible
- No asumir conocimiento previo de programacion

---

# PROCESO Y CALIBRACION DE CLAUDE CODE

> Restricciones operativas derivadas de 13 iteraciones de revision de seguridad.
> Se leen y aplican ANTES de cualquier trabajo tecnico complejo.

---

## PUNTO CIEGO ESTRUCTURAL

Claude Code optimiza por defecto para resolver el problema tecnico. La seguridad pasa a segundo plano automaticamente cuando el problema es complejo o "emocionante".

**REGLA NO NEGOCIABLE:** El analisis de seguridad se hace ANTES de disenar la funcionalidad.

**Protocolo obligatorio antes de disenar cualquier componente:**
1. Threat modeling: que puede salir mal, quien puede atacar esto
2. Trazar el flujo de cada dato sensible desde que nace hasta que muere
3. Identificar puntos de contacto: logs, memoria, DB, HTTP, filesystem, error paths, serializacion
4. Solo despues de completar 1-3: disenar la funcionalidad

---

## PARCHE LOCAL VS REVISION GLOBAL

Cuando se corrige un punto del plan, el comportamiento default es arreglar ese punto y seguir sin verificar si introdujo inconsistencias en otras secciones.

**REGLA OBLIGATORIA:** Despues de cada correccion, antes de presentar el plan actualizado:

> "Ahora que cambie esto, recorro todo el plan buscando inconsistencias que este cambio haya introducido. No presento el plan actualizado hasta completar esa revision."

**Casos de maxima urgencia:**
- Cambio en numeracion de pasos → verificar todas las referencias
- Cambio en nombre de funcion/variable → verificar todas las menciones
- Cambio en contrato de funcion → verificar celdas de la matriz que la referencian
- Cambio en un test → verificar que el comportamiento testeado esta documentado en el plan

---

## EJECUCION MENTAL OBLIGATORIA DE PSEUDOCODIGO

Antes de declarar completo cualquier bloque de pseudocodigo, ejecutarlo mentalmente con 3 escenarios:
- (A) Happy path
- (B) Excepcion en la primera linea
- (C) Excepcion en la ultima linea

Si el comportamiento en B o C no es el documentado, el bloque no esta completo.

**Especificamente para bloques `finally`:** Verificar que NINGUNA linea pueda lanzar una excepcion sin capturar, porque Python reemplaza la excepcion original.

**Especificamente para bloques `with`:** Verificar que `__exit__` se ejecuta en todos los paths, incluyendo excepciones en `__enter__`.

---

## VERIFICACION ARITMETICA POST-EDICION

Despues de cada sesion de edicion, antes de presentar el resultado:
1. Contar explicitamente (1, 2, 3...) los items de toda lista enumerada que tenga un header con "(N)"
2. Listar el conteo en el razonamiento interno
3. Si N no coincide, corregir ANTES de presentar

**No confiar en el conteo mental incremental.** Contar las filas reales.

---

## COHERENCIA CONDICION-COMENTARIO

Cuando un test tiene una condicion de exito/fallo Y un comentario explicativo, verificar que sean logicamente equivalentes.

Si la condicion dice `<=` y el comentario dice "igualdad = fallo", hay contradiccion. El comentario debe ser derivable de la condicion, no independiente.

---

## PROCESS REFLECTION

Cuando Pato pregunta "es capacidad o prioridad?" o "que protocolo seguiste?", la respuesta debe ser honesta y especifica — no defensiva, no general. Esa honestidad es la que permite mejorar el sistema.

---

## GATE OBLIGATORIO — ANTES DE LLAMAR ExitPlanMode

No se llama ExitPlanMode hasta completar este checklist:

1. Listar todos los items prometidos en iteraciones anteriores
2. Verificar que CADA UNO existe literalmente en el texto del plan actual
3. Por cada celda de la matriz de seguridad: senalar la linea exacta del codigo documentado que garantiza esa proteccion. Si no existe → la celda no es OK
4. Verificar consistencia global: buscar inconsistencias que cambios de esta iteracion hayan introducido
5. Verificacion aritmetica: contar tests, riesgos, celdas de matriz
6. Para cada bloque de pseudocodigo NUEVO o MODIFICADO en esta sesion,
   cambiar de perspectiva: dejar de ser el autor y pensar como un
   reviewer externo que conoce todas las reglas del sistema pero lee
   este codigo por primera vez.

   Proceso por cada bloque:
   a. Derivar el conjunto COMPLETO de reglas que aplican a este tipo
      de codigo — buscando en el plan, CLAUDE.md y patrones existentes,
      no solo las que recuerdo. Verificar cada una.
   b. Identificar todo input que este codigo recibe pero no controla
      (datos de APIs, headers HTTP, respuestas de DB, valores de config).
      Para cada uno: ¿que pasa si viene vacio, null, en formato inesperado,
      o en el valor limite exacto? ¿Falla de forma segura?
   c. Si no existe un test o instruccion que valide este bloque,
      el bloque no esta terminado.

   La pregunta guia NO es "¿es consistente con lo que cambie?"
   La pregunta guia ES "¿un reviewer que conoce las reglas del sistema
   pero nunca vio mis cambios encontraria una omision?"

7. Solo si los 6 pasos anteriores estan completos → llamar ExitPlanMode

La pregunta correcta por cada celda NO es "el diseno protege este dato?" — es "puedo senalar la linea exacta del codigo documentado que lo garantiza?"

---

## GESTION DE SESIONES

**Recomendar proactivamente sesion nueva cuando:**
- Ya ocurrio una compactacion en la sesion actual
- La tarea cambio de fase (planificacion → implementacion)
- El plan fue aprobado y se va a ejecutar codigo
- Sesion supera 2 horas en planificacion iterativa

**NO cambiar cuando:** implementacion activa con codigo en curso, o debugging con estado acumulado.

**Protocolo de traspaso:** Generar documento .md con decisiones tomadas, estado actual, proximos pasos, puntos pendientes. Al iniciar sesion nueva: leer el traspaso completo ANTES de cualquier accion.

## SESIONES DE AUDITORIA MULTIPASO — PROTOCOLO DE COMPACTACION

**Contexto:** Cuando Claude Code opera en sesiones de correccion secuencial
con protocolo de aprobacion del usuario (ej: auditorias de N hallazgos),
una compactacion automatica puede silenciosamente eliminar el protocolo
activo sin que el usuario lo note.

**Ante cualquier compactacion durante una sesion de auditoria multipaso:**

1. RELEER CLAUDE.md completo antes de continuar
2. RECONSTRUIR tabla de estado de correcciones:
   - Correcciones aprobadas (con ✅ explicito del usuario)
   - Correccion en curso (editada pero pendiente ✅)
   - Correcciones pendientes (no iniciadas)
3. RECONFIRMAR protocolo activo explicitamente:
   - BEFORE/AFTER literal antes de cada ✅
   - Verificacion con 3 escenarios (Regla Ejecucion Mental)
   - Revision global de inconsistencias (Regla Parche Local)
   - Esperar ✅ explicito del usuario antes de avanzar
4. PRESENTAR el resumen al usuario y esperar aprobacion
   explicita para reanudar — NO continuar automaticamente

**Criterio para NO cambiar de sesion:**
Si hay implementacion activa con estado acumulado
(correcciones parcialmente aplicadas), mantener la sesion
actual y aplicar los 4 pasos anteriores en su lugar.

**Criterio para SI recomendar sesion nueva:**
Si la compactacion ocurrio ANTES de iniciar cualquier
correccion, o si todas las correcciones ya tienen ✅,
recomendar sesion nueva es seguro.

---

# REGLAS DE SEGURIDAD CRITICAS

## ARCHIVOS PROHIBIDOS - NUNCA LEER NI MODIFICAR

- `.env` y `.env.*` (todas las variantes)
- `*.credentials.json`, `*secret*.json`, `*secrets*.yaml`
- `*.key`, `*.pem`, `*.crt`, `~/.ssh/*`, `/etc/ssl/private/*`
- `/etc/passwd`, `/etc/shadow`, `/etc/group`
- `/etc/ssh/sshd_config` (solo lectura, NUNCA modificar)
- Archivos de firewall (UFW, iptables) y fail2ban
- `~/backups/postgresql/` (backups de DB)
- Dumps de DB (*.sql, *.sql.gz)
- Archivos con datos personales de clientes

**ANTES de leer archivos en directorios config/, .env*, credentials/, secrets/, keys/, private/ → SIEMPRE preguntar.**

## DEBUGGING SEGURO

```bash
# NUNCA: cat .env, echo $DATABASE_URL, SELECT * FROM users
# SIEMPRE: redactar valores
cat .env | sed 's/=.*/=***REDACTED***/g'
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM customers;"
```

Nunca incluir en respuestas: API keys, tokens, passwords, JWT secrets, URLs con tokens en query params.

## OPERACIONES DE ALTO RIESGO - CONFIRMAR ANTES

**DB:** DROP/TRUNCATE, DELETE sin WHERE, ALTER TABLE en produccion, cambiar passwords
**Docker:** docker rm, docker volume rm, docker-compose down -v, modificar docker-compose.yml en prod
**Sistema:** Modificar sshd_config, firewall, fail2ban, permisos en /etc/
**Destructivas:** rm -rf, chmod 777, chown en archivos criticos

**Formato obligatorio antes de ejecutar:**
```
OPERACION DE ALTO RIESGO: [comando exacto]
Que hace: [explicacion simple]
Riesgos: [que puede salir mal]
Proceder? (si/no):
```

---

## SEGURIDAD MULTI-TENANT

1. **Aislamiento:** tenant_id + RLS en todas las tablas. NUNCA mezclar datos entre tenants.
2. **Queries:** SIEMPRE filtrar por tenant_id o depender de RLS. NUNCA `SELECT * FROM customers` sin filtro.
3. **Testing:** Verificar que tenant_A NO puede ver datos de tenant_B antes de deploy.
4. **Secrets:** Cada tenant tiene sus propias API keys. NUNCA compartir entre tenants.

---

## SEGURIDAD EN CONEXIONES API/ERP - PRINCIPIO FUNDAMENTAL

> **PRIORIDAD ABSOLUTA:** La seguridad del cliente es lo primero.
> PymePilot se conecta a ERPs que manejan datos criticos de cada empresa.
> Toda decision de diseno debe priorizar la proteccion del sistema del cliente.

### REGLA #1: SOLO LECTURA — NUNCA ESCRIBIR EN EL ERP DEL CLIENTE

```python
# El conector SOLO tiene metodos de lectura
class ERPConnector(ABC):
    def fetch_customers(self) -> list       # GET
    def fetch_products(self) -> list        # GET
    def fetch_orders(self, since) -> list   # GET
    def test_connection(self) -> bool       # GET

# NUNCA implementar _post(), _put(), _delete()
# Solo existe _get(). Fisicamente imposible escribir en el ERP.
```

### REGLA #2: CREDENCIALES DE SOLO LECTURA
Solicitar API key read-only. Documentar permisos/scopes necesarios.

### REGLA #3: RATE LIMITING RESPETUOSO
- Sync 1x/dia (5 AM), incremental (solo datos nuevos)
- Respetar 429 con backoff exponencial. Max 3 reintentos.
- Timeout 30s por request. Despues de agotar reintentos → esperar al dia siguiente.

### REGLA #4: AISLAMIENTO DE CREDENCIALES POR TENANT
- Credenciales en `tenants.erp_config` (JSONB), encriptadas en reposo
- NUNCA loguear credenciales, tokens, o API keys
- Si cliente revoca API key → perdemos acceso inmediatamente (es una FEATURE)

### REGLA #5: TRANSACCIONES ATOMICAS
O se completa toda la sync, o no se guarda nada. ROLLBACK completo si falla.

### REGLA #6: AUDITABILIDAD TOTAL
Cada sync registrada en `sync_log`: fecha, endpoints, registros leidos, errores, duracion.

### DEFENSA EN PROFUNDIDAD (4 capas)

| Capa | Proteccion |
|------|-----------|
| 1. Permisos API key | ERP rechaza operaciones no autorizadas |
| 2. Solo GET en codigo | No existen funciones para escribir |
| 3. ABC read-only | ERPConnector solo define lecturas |
| 4. Testing pre-prod | Verificar solo GETs antes de produccion |

### ANTES de conectar un nuevo ERP:
```
[] Investigar permisos de la API
[] Solicitar API key SOLO LECTURA
[] Documentar endpoints (solo GETs)
[] Testear con datos reales en modo manual supervisado
[] Registrar todo en sync_log
[] Recien entonces activar sync automatico
```

---

## MANEJO DE SECRETS

```bash
# Validar que un secret existe SIN mostrarlo:
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ANTHROPIC_API_KEY no configurada"
else
  echo "ANTHROPIC_API_KEY configurada (${#ANTHROPIC_API_KEY} caracteres)"
fi
```

**Backups:** `~/backups/postgresql/`, automaticos 3 AM, retencion 7 dias.
**Scripts:** `~/scripts/backup-postgresql.sh` (manual), `~/scripts/restore-postgresql.sh`
**SIEMPRE backup manual antes de cambios criticos.**

---

# CONTEXTO DEL PROYECTO

## Que es PymePilot

Sistema de BI para distribuidores mayoristas B2B en Argentina. Analiza datos del ERP para decir A QUIEN contactar, CUANDO, y QUE ofrecer.

**Cliente:** IEY (Distribuidor #1 MagSafe Argentina). Resultados validados en 6 meses: facturacion recurrente 34%→74%, churn 18%→8%.

**4 Verticales:** V1 Activacion Clientes Nuevos, V2 Reposicion Predictiva (MVP), V3 Cross-Sell, V4 Recuperacion Inactivos. Detalle completo en `docs/PRD.md`.

**Flujo:** ERP → PostgreSQL → Motor Python (diario 5 AM) → predictions → WhatsApp via Kommo (Fase 6).

---

# ARQUITECTURA TECNICA

## Stack
- **Frontend:** Next.js 14+ (App Router, TypeScript strict, Tailwind + shadcn/ui)
- **Backend:** Supabase self-hosted (PostgreSQL 15+, GoTrue, PostgREST, RLS) + Traefik
- **Motor:** Python 3.11+ (psycopg3, Anthropic Claude API, Pandas)
- **ERPs:** Contabilium API REST (primer conector), Excel/CSV (fallback)
- **Infra:** Contabo VPS 12GB RAM, Docker + Docker Compose (`/opt/orion-stack/`), Grafana + Prometheus

## Multi-tenant: tenant_id + RLS (NO schema-per-tenant)

Todas las tablas en schema public con `tenant_id`. RLS habilitado en: customers, products, orders, order_items, predictions, sync_log. Schema completo en `database/migrations/`.

## Estructura del proyecto

```
pymepilot/
├── backend/engine/
│   ├── verticales/          # V1-V4 (base.py + reposicion/activacion/cross_sell/recuperacion)
│   ├── connectors/          # ERPConnector ABC, contabilium.py, excel.py, sync.py, crypto.py
│   ├── claude/client.py     # Anthropic SDK
│   ├── db/connection.py     # Pool + tenant context
│   └── core/logger.py       # SanitizingFormatter
├── backend/config/settings.py
├── backend/scripts/         # sync_erp.py, setup_credentials.py, run_vertical.py
├── database/migrations/     # 001-010 + rollbacks
├── database/seed/           # dev_data.sql (doble guard)
├── frontend/                # Next.js (Fase 3)
├── docs/                    # PRD.md, ROADMAP.md, CONTABILIUM_API.md
└── .claude/skills/          # 6 agentes, 30 skills (ver seccion abajo)
```

**Docker:** Supabase stack en `/opt/orion-stack/docker-compose.yml` (separado del proyecto).
**DB:** PostgreSQL en container `orion-menteax_postgres`, IP 172.18.0.10:5432.

---

# WORKFLOWS

## Desarrollo
- **Antes de sesion:** `~/scripts/claude-safe.sh`
- **Durante:** Trabajar en `/home/pato/projects/pymepilot/`. Docker en `/opt/orion-stack/` (NO modificar sin confirmacion). SIN N8N: todo en Python.
- **Despues:** `~/scripts/claude-audit.sh`
- **Antes de deploy:** `~/scripts/backup-postgresql.sh`, verificar tests, verificar no hay secrets hardcodeados

## Comandos clave

```bash
# PostgreSQL
docker exec -it orion-menteax_postgres psql -U postgres
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM customers;"

# Docker
docker logs orion-menteax_postgres --tail 50
docker restart orion-menteax_postgres

# Backups
~/scripts/backup-postgresql.sh        # Manual
ls -lh ~/backups/postgresql/           # Ver disponibles
~/scripts/restore-postgresql.sh        # Restaurar

# Monitoreo
df -h    # Disco
free -h  # RAM
docker ps # Containers
```

## Crear nuevo tenant
```bash
~/projects/pymepilot/scripts/create-tenant.sh "Nombre" "slug" "erp_type"
```

## Nueva vertical (pasos)
1. Migration SQL + rollback
2. Clase Python que extiende VerticalBase
3. Prompt para Claude en `backend/config/prompts/`
4. Registrar en orquestador `backend/main.py`
5. Vista en dashboard
6. Testing con datos IEY
7. Deploy gradual

---

# PRINCIPIOS DE CODIGO

**Python:** Type hints en todas las funciones. Docstrings Google. try/except especificos. Logging (no prints). venv.
**TypeScript:** Strict mode. Nunca `any`. Componentes como funciones. Validacion con Zod.
**SQL:** SIEMPRE prepared statements (nunca concatenar strings). Indexes en WHERE/JOIN. EXPLAIN ANALYZE para queries lentas.
**Git:** Commits descriptivos (`feat:`, `fix:`). Branches por feature. NUNCA commitear secrets.

**Anti-patterns:** No hardcodear API keys. No loguear secrets. No queries N+1. No SELECT *. No mezclar datos entre tenants. No logica de negocio en frontend.

---

# EMERGENCIA

**Servidor caido:** `docker ps -a` → `docker-compose restart` → `docker logs` → ultimo recurso: `~/scripts/restore-postgresql.sh`
**Backups fallan:** `tail -100 ~/backups/backup-cron.log` → ejecutar manual → verificar `df -h`

---

# SKILLS Y AGENTES

6 agentes especializados con 30 skills en `.claude/skills/`:

| Agente | Area | Skills en |
|--------|------|-----------|
| @security-guardian | Auditoria de seguridad pre-deploy | `skills/security/` |
| @db-architect | PostgreSQL multi-tenant, RLS, migraciones | `skills/database/` |
| @supabase-backend | Auth, Edge Functions, Storage, Realtime | `skills/supabase/` |
| @python-engine | Claude API, verticales, psycopg3, logging | `skills/python/` |
| @nextjs-dashboard | App Router, Server Actions, shadcn/ui | `skills/nextjs/` |
| @api-integrations | OAuth, REST, webhooks, circuit breaker | `skills/integrations/` |

**Invocar:** "Necesito [tarea]. Consulta con @[agente] usando el skill [nombre]"
