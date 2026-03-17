\# Skill: PostgreSQL Schemas para Multi-Tenant

\#\# 🎯 Qué es  
Guía completa para diseñar schemas de PostgreSQL optimizados para arquitectura multi-tenant en PymePilot. Cubre estructura de tablas, tipos de datos, constraints, indexes y relaciones.

\*\*Analogía Simple:\*\*  
Un schema de DB es como el plano de un edificio de departamentos:  
\- Cada tabla \= habitación con un propósito específico  
\- Columnas \= muebles/instalaciones en esa habitación  
\- Foreign keys \= puertas que conectan habitaciones  
\- Indexes \= directorio del edificio (para encontrar cosas rápido)  
\- Constraints \= códigos de edificación (reglas que se deben cumplir)

\*\*En PymePilot:\*\*  
\- Diseñamos tablas para customers, products, predictions  
\- Cada tabla tiene tenant\_id (aislamiento)  
\- Relaciones claras entre entidades  
\- Optimizado para queries frecuentes

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE cuando:  
\- ✅ Creás una tabla nueva  
\- ✅ Modificás estructura de tabla existente  
\- ✅ Agregás relaciones entre tablas  
\- ✅ Definís tipos de datos para columnas

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Diseñás el schema inicial del proyecto  
\- ⚠️ Migrás desde otra arquitectura  
\- ⚠️ Escalás a múltiples tenants  
\- ⚠️ Optimizás performance de queries

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Estructura Base de Tabla Multi-Tenant

\*\*Template de tabla estándar:\*\*  
\`\`\`sql  
CREATE TABLE nombre\_tabla (  
    \-- Primary Key (SIEMPRE UUID)  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Multi-Tenant (TODAS las tablas excepto maestras)  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    \-- Columnas de negocio  
    \-- ...  
      
    \-- Timestamps (SIEMPRE)  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Index en tenant\_id (OBLIGATORIO)  
CREATE INDEX idx\_nombre\_tabla\_tenant\_id ON nombre\_tabla(tenant\_id);

\-- Trigger para updated\_at automático  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON nombre\_tabla  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

\-- RLS (OBLIGATORIO para multi-tenant)  
ALTER TABLE nombre\_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant\_isolation\_policy ON nombre\_tabla  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\*\*Explicación de cada componente:\*\*  
\`\`\`sql  
\-- 1\. PRIMARY KEY como UUID  
id UUID PRIMARY KEY DEFAULT gen\_random\_uuid()

\-- Por qué UUID y no SERIAL:  
\-- ✅ Único globalmente (sin colisiones entre tenants)  
\-- ✅ No predecible (seguridad)  
\-- ✅ Portable entre DBs  
\-- ❌ Ocupa más espacio que INTEGER (16 bytes vs 4 bytes)  
\-- ❌ Ligeramente más lento (aceptable para PymePilot)

\-- 2\. tenant\_id con FK y CASCADE  
tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE

\-- ON DELETE CASCADE significa:  
\-- Si elimino un tenant → se eliminan automáticamente todos sus datos  
\-- CUIDADO: Esto es DESTRUCTIVO pero correcto en multi-tenant

\-- 3\. Timestamps con zona horaria  
created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

\-- TIMESTAMPTZ vs TIMESTAMP:  
\-- ✅ TIMESTAMPTZ guarda timezone (crucial para multi-región)  
\-- NOW() da timestamp actual del servidor  
\`\`\`

\#\#\# Práctica 2: Tipos de Datos Correctos

\*\*Guía de tipos para columnas comunes:\*\*  
\`\`\`sql  
\-- IDENTIFICADORES  
id UUID                              \-- PKs, FKs  
external\_id TEXT                     \-- IDs de sistemas externos (Kommo, WhatsApp)

\-- TEXTO  
name TEXT NOT NULL                   \-- Nombres (sin límite)  
email TEXT                           \-- Emails (validar con CHECK)  
description TEXT                     \-- Descripciones largas  
sku VARCHAR(50)                      \-- SKUs (límite conocido)

\-- NÚMEROS  
price DECIMAL(10, 2\)                 \-- Precios (exactos, no FLOAT)  
quantity INTEGER                     \-- Cantidades enteras  
percentage DECIMAL(5, 2\)             \-- Porcentajes (0.00 a 100.00)  
confidence\_score DECIMAL(3, 2\)       \-- Scores ML (0.00 a 1.00)

\-- BOOLEANOS  
is\_active BOOLEAN NOT NULL DEFAULT true  
phone\_verified BOOLEAN NOT NULL DEFAULT false

\-- FECHAS Y HORAS  
created\_at TIMESTAMPTZ               \-- Timestamp con zona  
birth\_date DATE                      \-- Solo fecha (sin hora)  
scheduled\_time TIME                  \-- Solo hora (sin fecha)

\-- JSON  
metadata JSONB                       \-- Datos flexibles (usar con moderación)  
settings JSONB DEFAULT '{}'::jsonb   \-- Configuraciones

\-- ENUMS (para valores fijos)  
CREATE TYPE order\_status AS ENUM ('pending', 'processing', 'completed', 'cancelled');  
status order\_status NOT NULL DEFAULT 'pending'

\-- ARRAYS (usar con cuidado)  
tags TEXT\[\]                          \-- Array de strings  
\`\`\`

\*\*Errores comunes de tipos:\*\*  
\`\`\`sql  
\-- ❌ MAL \- FLOAT para dinero  
price FLOAT  \-- Puede perder precisión (0.1 \+ 0.2 \!= 0.3)

\-- ✅ BIEN \- DECIMAL para dinero  
price DECIMAL(10, 2\)  \-- Exacto

\-- ❌ MAL \- VARCHAR sin razón  
name VARCHAR(255)  \-- Límite arbitrario

\-- ✅ BIEN \- TEXT si no hay límite real  
name TEXT  \-- Sin límite artificial

\-- ❌ MAL \- TIMESTAMP sin zona  
created\_at TIMESTAMP

\-- ✅ BIEN \- TIMESTAMPTZ  
created\_at TIMESTAMPTZ  
\`\`\`

\#\#\# Práctica 3: Constraints para Integridad de Datos

\*\*Tipos de constraints:\*\*  
\`\`\`sql  
\-- 1\. NOT NULL (campo obligatorio)  
email TEXT NOT NULL

\-- 2\. UNIQUE (valor único en tabla)  
email TEXT UNIQUE  
\-- O combinado:  
UNIQUE(tenant\_id, email)  \-- Email único POR TENANT

\-- 3\. CHECK (validación custom)  
CHECK (price \> 0\)  
CHECK (percentage \>= 0 AND percentage \<= 100\)  
CHECK (email \~\* '^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\.\[A-Za-z\]{2,}$')

\-- 4\. FOREIGN KEY con políticas  
FOREIGN KEY (tenant\_id) REFERENCES tenants(id) ON DELETE CASCADE  
FOREIGN KEY (customer\_id) REFERENCES customers(id) ON DELETE SET NULL

\-- 5\. DEFAULT (valor por defecto)  
status TEXT DEFAULT 'active'  
created\_at TIMESTAMPTZ DEFAULT NOW()  
\`\`\`

\*\*Ejemplo completo de tabla con constraints:\*\*  
\`\`\`sql  
CREATE TABLE customers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    \-- Constraints en definición de columna  
    name TEXT NOT NULL,  
    email TEXT NOT NULL CHECK (  
        email \~\* '^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\.\[A-Za-z\]{2,}$'  
    ),  
    phone TEXT CHECK (  
        phone \~ '^\\+?\[1-9\]\\d{1,14}$'  \-- E.164 format  
    ),  
      
    \-- Enums para estados fijos  
    status TEXT NOT NULL DEFAULT 'active' CHECK (  
        status IN ('active', 'inactive', 'suspended')  
    ),  
      
    \-- Validación de rangos  
    credit\_limit DECIMAL(10, 2\) CHECK (credit\_limit \>= 0),  
      
    \-- Timestamps  
    last\_purchase\_date DATE,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Constraints a nivel tabla  
    CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email),  
    CONSTRAINT valid\_dates CHECK (  
        last\_purchase\_date IS NULL OR last\_purchase\_date \<= CURRENT\_DATE  
    )  
);  
\`\`\`

\#\#\# Práctica 4: Indexes Estratégicos

\*\*Reglas de indexing:\*\*  
\`\`\`sql  
\-- SIEMPRE crear index en:  
\-- 1\. tenant\_id (TODAS las tablas multi-tenant)  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);

\-- 2\. Foreign keys  
CREATE INDEX idx\_orders\_customer\_id ON orders(customer\_id);

\-- 3\. Columnas de filtrado frecuente  
CREATE INDEX idx\_customers\_status ON customers(status);  
CREATE INDEX idx\_customers\_last\_purchase ON customers(last\_purchase\_date);

\-- 4\. Columnas de ordenamiento frecuente  
CREATE INDEX idx\_customers\_name ON customers(name);

\-- 5\. Combinaciones usadas juntas (composite index)  
CREATE INDEX idx\_customers\_tenant\_status   
    ON customers(tenant\_id, status);  
\-- Útil para: WHERE tenant\_id \= X AND status \= Y  
\`\`\`

\*\*Tipos de indexes:\*\*  
\`\`\`sql  
\-- B-tree (default, para la mayoría de casos)  
CREATE INDEX idx\_customers\_email ON customers(email);

\-- Partial index (solo indexa subset de rows)  
CREATE INDEX idx\_active\_customers   
    ON customers(tenant\_id)   
    WHERE status \= 'active';  
\-- Más pequeño y rápido que indexar toda la tabla

\-- Index en expresión  
CREATE INDEX idx\_customers\_email\_lower   
    ON customers(LOWER(email));  
\-- Para búsquedas case-insensitive

\-- GIN index (para JSONB, arrays, full-text search)  
CREATE INDEX idx\_customers\_metadata   
    ON customers USING GIN(metadata);

\-- Index único (también es constraint)  
CREATE UNIQUE INDEX idx\_customers\_tenant\_email   
    ON customers(tenant\_id, email);  
\`\`\`

\*\*Cuándo NO crear index:\*\*  
\`\`\`sql  
\-- ❌ NO indexar:  
\-- 1\. Tablas muy pequeñas (\<1000 rows)  
\-- 2\. Columnas que cambian frecuentemente  
\-- 3\. Columnas con baja cardinalidad (ej: boolean)  
\-- 4\. Cuando el index ocupa más que la tabla

\-- Ejemplo: NO indexar  
CREATE INDEX idx\_customers\_is\_active ON customers(is\_active);  
\-- Razón: Solo 2 valores posibles (true/false) \- index no ayuda  
\`\`\`

\#\#\# Práctica 5: Relaciones entre Tablas

\*\*ON DELETE Policies:\*\*  
\`\`\`sql  
\-- CASCADE: Eliminar en cascada  
tenant\_id UUID REFERENCES tenants(id) ON DELETE CASCADE  
\-- Si elimino tenant → elimino automáticamente todos sus customers

\-- SET NULL: Setear a NULL  
assigned\_user\_id UUID REFERENCES users(id) ON DELETE SET NULL  
\-- Si elimino usuario → sus tareas quedan sin asignar (NULL)

\-- RESTRICT (default): Prevenir eliminación  
category\_id UUID REFERENCES categories(id) ON DELETE RESTRICT  
\-- No puedo eliminar categoría si tiene productos

\-- NO ACTION: Similar a RESTRICT  
\-- Diferencia: se verifica al final de la transacción

\-- SET DEFAULT: Setear a valor por defecto  
status\_id UUID REFERENCES statuses(id) ON DELETE SET DEFAULT  
\`\`\`

\*\*Ejemplo de relaciones en PymePilot:\*\*  
\`\`\`sql  
\-- Customers → Tenants (CASCADE)  
CREATE TABLE customers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    \-- Si elimino tenant IEY → elimino todos sus customers  
    ...  
);

\-- Orders → Customers (RESTRICT)  
CREATE TABLE orders (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    customer\_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,  
    \-- No puedo eliminar customer si tiene orders  
    ...  
);

\-- Predictions → Customers (SET NULL)  
CREATE TABLE predictions (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    customer\_id UUID REFERENCES customers(id) ON DELETE SET NULL,  
    \-- Si elimino customer → prediction queda huérfana pero se conserva  
    ...  
);  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Tabla Customers Completa  
\`\`\`sql  
\-- Tabla de clientes para PymePilot  
CREATE TABLE customers (  
    \-- Identificadores  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    \-- Información básica  
    name TEXT NOT NULL,  
    email TEXT NOT NULL CHECK (  
        email \~\* '^\[A-Za-z0-9.\_%+-\]+@\[A-Za-z0-9.-\]+\\.\[A-Za-z\]{2,}$'  
    ),  
    phone TEXT CHECK (  
        phone \~ '^\\+?\[1-9\]\\d{1,14}$'  
    ),  
      
    \-- Información comercial  
    company\_name TEXT,  
    tax\_id TEXT,  
    credit\_limit DECIMAL(10, 2\) DEFAULT 0 CHECK (credit\_limit \>= 0),  
      
    \-- Categorización  
    status TEXT NOT NULL DEFAULT 'active' CHECK (  
        status IN ('active', 'inactive', 'suspended', 'blocked')  
    ),  
    customer\_type TEXT CHECK (  
        customer\_type IN ('retail', 'wholesale', 'distributor')  
    ),  
      
    \-- Histórico  
    first\_purchase\_date DATE,  
    last\_purchase\_date DATE,  
    total\_purchases\_count INTEGER DEFAULT 0 CHECK (total\_purchases\_count \>= 0),  
    total\_purchases\_amount DECIMAL(12, 2\) DEFAULT 0 CHECK (total\_purchases\_amount \>= 0),  
      
    \-- Metadata flexible  
    metadata JSONB DEFAULT '{}'::jsonb,  
      
    \-- Timestamps  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Constraints a nivel tabla  
    CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email),  
    CONSTRAINT valid\_purchase\_dates CHECK (  
        first\_purchase\_date IS NULL OR   
        last\_purchase\_date IS NULL OR   
        first\_purchase\_date \<= last\_purchase\_date  
    )  
);

\-- Indexes  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);  
CREATE INDEX idx\_customers\_email ON customers(email);  
CREATE INDEX idx\_customers\_status ON customers(tenant\_id, status);  
CREATE INDEX idx\_customers\_last\_purchase ON customers(last\_purchase\_date);  
CREATE INDEX idx\_customers\_metadata ON customers USING GIN(metadata);

\-- Partial index para customers activos  
CREATE INDEX idx\_active\_customers   
    ON customers(tenant\_id, last\_purchase\_date)   
    WHERE status \= 'active';

\-- Trigger para updated\_at  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON customers  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

\-- RLS  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant\_isolation\_policy ON customers  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Comentarios para documentación  
COMMENT ON TABLE customers IS 'Clientes de distribuidores (multi-tenant)';  
COMMENT ON COLUMN customers.metadata IS 'Campos custom por tenant (JSONB flexible)';  
COMMENT ON COLUMN customers.total\_purchases\_amount IS 'Suma total de compras históricas';  
\`\`\`

\#\#\# Ejemplo 2: Tabla Products  
\`\`\`sql  
CREATE TABLE products (  
    \-- Identificadores  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    \-- Información del producto  
    sku TEXT NOT NULL,  
    name TEXT NOT NULL,  
    description TEXT,  
      
    \-- Precios  
    cost\_price DECIMAL(10, 2\) CHECK (cost\_price \>= 0),  
    sale\_price DECIMAL(10, 2\) NOT NULL CHECK (sale\_price \>= 0),  
      
    \-- Categorización  
    category TEXT,  
    brand TEXT,  
      
    \-- Inventario  
    stock\_quantity INTEGER DEFAULT 0 CHECK (stock\_quantity \>= 0),  
    min\_stock\_level INTEGER DEFAULT 0 CHECK (min\_stock\_level \>= 0),  
      
    \-- Estado  
    is\_active BOOLEAN NOT NULL DEFAULT true,  
      
    \-- Metadata  
    attributes JSONB DEFAULT '{}'::jsonb,  
    \-- Ejemplo: {"color": "red", "size": "M", "weight\_kg": 1.5}  
      
    \-- Timestamps  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Constraints  
    CONSTRAINT unique\_sku\_per\_tenant UNIQUE (tenant\_id, sku),  
    CONSTRAINT valid\_prices CHECK (  
        cost\_price IS NULL OR   
        sale\_price IS NULL OR   
        sale\_price \>= cost\_price  
    )  
);

\-- Indexes  
CREATE INDEX idx\_products\_tenant\_id ON products(tenant\_id);  
CREATE INDEX idx\_products\_sku ON products(tenant\_id, sku);  
CREATE INDEX idx\_products\_category ON products(tenant\_id, category);  
CREATE INDEX idx\_products\_active ON products(tenant\_id) WHERE is\_active \= true;  
CREATE INDEX idx\_products\_low\_stock   
    ON products(tenant\_id, stock\_quantity)   
    WHERE stock\_quantity \<= min\_stock\_level;

\-- Trigger  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON products  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

\-- RLS  
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant\_isolation\_policy ON products  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);  
\`\`\`

\#\#\# Ejemplo 3: Tabla Predictions (Verticales IA)  
\`\`\`sql  
CREATE TABLE predictions (  
    \-- Identificadores  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    customer\_id UUID REFERENCES customers(id) ON DELETE SET NULL,  
    \-- Si elimino customer, conservo prediction para análisis  
      
    \-- Tipo de vertical  
    vertical TEXT NOT NULL CHECK (  
        vertical IN ('activacion', 'reposicion', 'cross\_sell', 'recuperacion')  
    ),  
      
    \-- Output de Claude API  
    message\_text TEXT NOT NULL,  
    reasoning TEXT,  \-- Explicación del por qué (extended thinking)  
    confidence\_score DECIMAL(3, 2\) CHECK (  
        confidence\_score \>= 0 AND confidence\_score \<= 1  
    ),  
      
    \-- Productos recomendados (si aplica)  
    recommended\_product\_ids UUID\[\],  
      
    \-- Estado del mensaje  
    status TEXT NOT NULL DEFAULT 'pending' CHECK (  
        status IN ('pending', 'approved', 'sent', 'delivered', 'opened', 'clicked', 'rejected')  
    ),  
      
    \-- Metadata de Claude API  
    claude\_model TEXT,  \-- ej: claude-sonnet-4-20250514  
    prompt\_tokens INTEGER,  
    completion\_tokens INTEGER,  
      
    \-- Resultados  
    was\_sent BOOLEAN DEFAULT false,  
    sent\_at TIMESTAMPTZ,  
    response\_received BOOLEAN DEFAULT false,  
    response\_text TEXT,  
      
    \-- Timestamps  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Constraints  
    CONSTRAINT valid\_tokens CHECK (  
        prompt\_tokens IS NULL OR prompt\_tokens \> 0  
    ),  
    CONSTRAINT sent\_timestamp CHECK (  
        (was\_sent \= false AND sent\_at IS NULL) OR  
        (was\_sent \= true AND sent\_at IS NOT NULL)  
    )  
);

\-- Indexes  
CREATE INDEX idx\_predictions\_tenant\_id ON predictions(tenant\_id);  
CREATE INDEX idx\_predictions\_customer\_id ON predictions(customer\_id);  
CREATE INDEX idx\_predictions\_vertical ON predictions(tenant\_id, vertical);  
CREATE INDEX idx\_predictions\_status ON predictions(tenant\_id, status);  
CREATE INDEX idx\_predictions\_created\_at ON predictions(created\_at DESC);

\-- Partial indexes para queries comunes  
CREATE INDEX idx\_pending\_predictions   
    ON predictions(tenant\_id, created\_at)   
    WHERE status \= 'pending';

CREATE INDEX idx\_sent\_predictions   
    ON predictions(tenant\_id, sent\_at DESC)   
    WHERE was\_sent \= true;

\-- Trigger  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON predictions  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

\-- RLS  
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant\_isolation\_policy ON predictions  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Comentarios  
COMMENT ON TABLE predictions IS 'Predicciones generadas por verticales de IA (Claude API)';  
COMMENT ON COLUMN predictions.vertical IS 'activacion|reposicion|cross\_sell|recuperacion';  
COMMENT ON COLUMN predictions.reasoning IS 'Explicación de Claude sobre por qué generó este mensaje';  
\`\`\`

\#\#\# Ejemplo 4: Función Trigger para updated\_at  
\`\`\`sql  
\-- Función reutilizable para actualizar updated\_at  
CREATE OR REPLACE FUNCTION trigger\_set\_updated\_at()  
RETURNS TRIGGER AS $$  
BEGIN  
    NEW.updated\_at \= NOW();  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

\-- Uso en múltiples tablas:  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON customers  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON products  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON predictions  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: No usar tenant\_id en tabla multi-tenant  
\`\`\`sql  
\-- ❌ MAL  
CREATE TABLE customers (  
    id UUID PRIMARY KEY,  
    name TEXT,  
    email TEXT  
);  
\-- Sin tenant\_id → Todos los tenants ven todos los customers

\-- ✅ BIEN  
CREATE TABLE customers (  
    id UUID PRIMARY KEY,  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    name TEXT,  
    email TEXT  
);  
\`\`\`

\#\#\# Error 2: UNIQUE sin considerar tenant  
\`\`\`sql  
\-- ❌ MAL  
email TEXT UNIQUE  
\-- Email único GLOBALMENTE → Customer de IEY no puede usar mismo email que customer de DEMO

\-- ✅ BIEN  
CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email)  
\-- Email único POR TENANT → OK que IEY y DEMO tengan customer con mismo email  
\`\`\`

\#\#\# Error 3: No indexar tenant\_id  
\`\`\`sql  
\-- ❌ MAL  
CREATE TABLE customers (  
    id UUID PRIMARY KEY,  
    tenant\_id UUID NOT NULL,  
    ...  
);  
\-- Sin index → Queries lentas porque escanea toda la tabla

\-- ✅ BIEN  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);  
\-- Con index → Queries rápidas  
\`\`\`

\#\#\# Error 4: Usar SERIAL en vez de UUID  
\`\`\`sql  
\-- ❌ MAL (para multi-tenant)  
id SERIAL PRIMARY KEY  
\-- Predecible, colisiones posibles entre tenants

\-- ✅ BIEN  
id UUID PRIMARY KEY DEFAULT gen\_random\_uuid()  
\-- Único globalmente, no predecible  
\`\`\`

\#\#\# Error 5: FLOAT para precios  
\`\`\`sql  
\-- ❌ MAL  
price FLOAT  
\-- 0.1 \+ 0.2 \= 0.30000000000000004 (impreciso)

\-- ✅ BIEN  
price DECIMAL(10, 2\)  
\-- Exacto para dinero  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Para CADA tabla nueva:  
\- \[ \] Tiene \`id UUID PRIMARY KEY DEFAULT gen\_random\_uuid()\`  
\- \[ \] Tiene \`tenant\_id UUID NOT NULL\` (excepto tablas maestras)  
\- \[ \] Tiene \`created\_at TIMESTAMPTZ DEFAULT NOW()\`  
\- \[ \] Tiene \`updated\_at TIMESTAMPTZ DEFAULT NOW()\`  
\- \[ \] Index en \`tenant\_id\`  
\- \[ \] Trigger para \`updated\_at\`  
\- \[ \] RLS habilitado  
\- \[ \] Constraints de validación (NOT NULL, CHECK)  
\- \[ \] Foreign keys con ON DELETE apropiado  
\- \[ \] Comentarios de documentación

\#\#\# Para relaciones:  
\- \[ \] Foreign keys definidas  
\- \[ \] ON DELETE policy correcta (CASCADE/SET NULL/RESTRICT)  
\- \[ \] Indexes en foreign keys  
\- \[ \] No hay relaciones circulares

\#\#\# Para performance:  
\- \[ \] Indexes en columnas de filtrado  
\- \[ \] Indexes en columnas de ordenamiento  
\- \[ \] Partial indexes para queries comunes  
\- \[ \] NO over-indexing (justificar cada index)

\---

\#\# 📊 Métricas de Éxito

Schema bien diseñado si:  
\- ✅ 100% de tablas multi-tenant tienen tenant\_id  
\- ✅ 100% de tablas tienen RLS habilitado  
\- ✅ 0 columnas con tipos incorrectos (FLOAT para precio, etc.)  
\- ✅ Queries comunes \<100ms  
\- ✅ Constraints previenen data inválida (0 errores en producción)

\---

\#\# 💡 Para Pato (Uso Práctico)

\#\#\# Tu primer schema (paso a paso)

\*\*Paso 1: Tabla tenants (maestra, sin tenant\_id)\*\*  
\`\`\`sql  
CREATE TABLE tenants (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    name TEXT NOT NULL,  
    email TEXT NOT NULL UNIQUE,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);  
\`\`\`

\*\*Paso 2: Tabla customers (con tenant\_id)\*\*  
\`\`\`  
@db-architect usando /skills/database/postgresql-schemas.md  
generá schema completo para tabla customers según template

Incluir:  
\- tenant\_id con FK a tenants  
\- name, email, phone  
\- status (active/inactive)  
\- last\_purchase\_date  
\- RLS \+ indexes  
\`\`\`

\*\*Paso 3: Validar con @security-guardian\*\*  
\`\`\`  
@security-guardian auditá el schema de customers  
Verificá tenant\_id, RLS, indexes  
\`\`\`

\#\#\# Comandos útiles en psql  
\`\`\`sql  
\-- Ver estructura de tabla  
\\d customers

\-- Ver indexes  
\\di

\-- Ver constraints  
\\d+ customers

\-- Ver RLS policies  
\\d customers  
\-- Mira la sección "Policies"

\-- Explicar query (ver si usa indexes)  
EXPLAIN ANALYZE SELECT \* FROM customers WHERE tenant\_id \= 'uuid';  
\`\`\`

\---  
