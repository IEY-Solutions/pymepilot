\# Skill: Migrations Seguras

\#\# 🎯 Qué es  
Sistema completo para crear, ejecutar y revertir migrations de base de datos de forma SEGURA en PymePilot. Cada migration tiene su rollback, testing en staging, y documentación clara.

\*\*Analogía Simple:\*\*  
Una migration es como una renovación en un edificio en funcionamiento:  
\- No podés dejar inquilinos sin agua/luz (downtime)  
\- Necesitás plan B si algo sale mal (rollback)  
\- Probás primero en maqueta (staging)  
\- Documentás qué hiciste (para el próximo)

En base de datos:  
\- Migration \= cambio en estructura (agregar tabla, columna, index)  
\- Rollback \= deshacer el cambio si falla  
\- Staging \= probar con datos reales ANTES de producción  
\- Zero-downtime \= aplicación sigue funcionando durante migration

\*\*Por qué es CRÍTICO para PymePilot:\*\*  
\- IEY y futuros clientes dependen de la DB 24/7  
\- Un error en migration puede perder datos  
\- Rollback permite volver atrás si algo falla  
\- Testing previene desastres en producción

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear/modificar estructura de tablas  
\- ✅ Al agregar/eliminar columnas  
\- ✅ Al crear/modificar indexes  
\- ✅ Al cambiar constraints o FKs  
\- ✅ Antes de CADA deployment

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Migration afecta tablas con datos  
\- ⚠️ Migration puede causar downtime  
\- ⚠️ Migration modifica datos (no solo estructura)  
\- ⚠️ Migration toca tablas críticas (customers, orders)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Estructura de Archivos de Migration

\*\*Convención de nombres:\*\*  
\`\`\`  
migrations/  
├── 001\_create\_tenants.sql  
├── 001\_rollback.sql  
├── 002\_create\_customers.sql  
├── 002\_rollback.sql  
├── 003\_create\_products.sql  
├── 003\_rollback.sql  
├── 004\_add\_customer\_phone.sql  
├── 004\_rollback.sql  
└── README.md  
\`\`\`

\*\*Reglas de nombrado:\*\*  
\- Número secuencial de 3 dígitos (001, 002, 003...)  
\- Nombre descriptivo en snake\_case  
\- SIEMPRE archivo de rollback con mismo número  
\- README.md documenta qué hace cada migration

\*\*Template de migration:\*\*  
\`\`\`sql  
\-- Migration: 001\_create\_customers.sql  
\-- Description: Crear tabla customers con RLS y indexes  
\-- Author: Pato  
\-- Date: 2025-02-16  
\-- Dependencies: Requiere tabla tenants (000\_create\_tenants.sql)

\-- \=============================================================================  
\-- MIGRATION START  
\-- \=============================================================================

BEGIN;

\-- 1\. Crear tabla  
CREATE TABLE IF NOT EXISTS customers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    name TEXT NOT NULL,  
    email TEXT NOT NULL,  
    phone TEXT,  
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),  
      
    last\_purchase\_date DATE,  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email)  
);

\-- 2\. Crear indexes  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);  
CREATE INDEX idx\_customers\_email ON customers(email);  
CREATE INDEX idx\_customers\_status ON customers(tenant\_id, status);

\-- 3\. Crear trigger para updated\_at  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON customers  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();

\-- 4\. Habilitar RLS  
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

\-- 5\. Crear RLS policy  
CREATE POLICY tenant\_isolation\_policy ON customers  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid)  
    WITH CHECK (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- 6\. Agregar comentarios  
COMMENT ON TABLE customers IS 'Clientes de distribuidores (multi-tenant)';  
COMMENT ON COLUMN customers.tenant\_id IS 'FK a tabla tenants \- aislamiento multi-tenant';

COMMIT;

\-- \=============================================================================  
\-- MIGRATION END  
\-- \=============================================================================

\-- Verificación post-migration  
DO $$  
BEGIN  
    \-- Verificar que tabla existe  
    IF NOT EXISTS (SELECT 1 FROM pg\_tables WHERE tablename \= 'customers') THEN  
        RAISE EXCEPTION 'Migration failed: table customers not created';  
    END IF;  
      
    \-- Verificar que RLS está habilitado  
    IF NOT EXISTS (  
        SELECT 1 FROM pg\_tables   
        WHERE tablename \= 'customers' AND rowsecurity \= true  
    ) THEN  
        RAISE EXCEPTION 'Migration failed: RLS not enabled on customers';  
    END IF;  
      
    RAISE NOTICE 'Migration 001\_create\_customers completed successfully';  
END $$;  
\`\`\`

\*\*Template de rollback:\*\*  
\`\`\`sql  
\-- Rollback: 001\_rollback.sql  
\-- Description: Revertir creación de tabla customers  
\-- Author: Pato  
\-- Date: 2025-02-16

\-- \=============================================================================  
\-- ROLLBACK START  
\-- \=============================================================================

BEGIN;

\-- Deshacer en orden INVERSO a la migration

\-- 1\. Drop policies (si existen)  
DROP POLICY IF EXISTS tenant\_isolation\_policy ON customers;

\-- 2\. Disable RLS  
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;

\-- 3\. Drop triggers  
DROP TRIGGER IF EXISTS set\_updated\_at ON customers;

\-- 4\. Drop indexes (se eliminan automáticamente con DROP TABLE, pero explícito es mejor)  
DROP INDEX IF EXISTS idx\_customers\_tenant\_id;  
DROP INDEX IF EXISTS idx\_customers\_email;  
DROP INDEX IF EXISTS idx\_customers\_status;

\-- 5\. Drop tabla  
DROP TABLE IF EXISTS customers;

COMMIT;

\-- \=============================================================================  
\-- ROLLBACK END  
\-- \=============================================================================

\-- Verificación post-rollback  
DO $$  
BEGIN  
    IF EXISTS (SELECT 1 FROM pg\_tables WHERE tablename \= 'customers') THEN  
        RAISE EXCEPTION 'Rollback failed: table customers still exists';  
    END IF;  
      
    RAISE NOTICE 'Rollback 001 completed successfully';  
END $$;  
\`\`\`

\#\#\# Práctica 2: Migrations que Modifican Datos

\*\*Caso: Agregar columna con valor default basado en data existente\*\*  
\`\`\`sql  
\-- Migration: 005\_add\_customer\_tier.sql  
\-- Description: Agregar columna tier calculada de total\_purchases  
\-- CUIDADO: Esta migration modifica data existente

BEGIN;

\-- 1\. Agregar columna (permite NULL inicialmente)  
ALTER TABLE customers   
ADD COLUMN tier TEXT;

\-- 2\. Poblar columna con lógica de negocio  
UPDATE customers  
SET tier \= CASE  
    WHEN total\_purchases\_amount \>= 1000000 THEN 'gold'  
    WHEN total\_purchases\_amount \>= 500000 THEN 'silver'  
    ELSE 'bronze'  
END;

\-- 3\. Ahora sí, hacer NOT NULL con default  
ALTER TABLE customers  
ALTER COLUMN tier SET NOT NULL,  
ALTER COLUMN tier SET DEFAULT 'bronze';

\-- 4\. Agregar constraint  
ALTER TABLE customers  
ADD CONSTRAINT check\_tier CHECK (tier IN ('bronze', 'silver', 'gold'));

COMMIT;  
\`\`\`

\*\*Rollback correspondiente:\*\*  
\`\`\`sql  
\-- Rollback: 005\_rollback.sql

BEGIN;

\-- Simplemente drop la columna (PostgreSQL maneja constraints automáticamente)  
ALTER TABLE customers DROP COLUMN IF EXISTS tier;

COMMIT;  
\`\`\`

\*\*⚠️ IMPORTANTE para migrations de data:\*\*  
\- SIEMPRE hacer backup antes  
\- Testear con datos REALES en staging  
\- Considerar performance (UPDATE de millones de rows puede ser lento)  
\- Usar batches para tablas grandes

\#\#\# Práctica 3: Migrations Zero-Downtime

\*\*Problema: Renombrar columna causa downtime\*\*  
\`\`\`sql  
\-- ❌ MAL \- Causa downtime  
ALTER TABLE customers RENAME COLUMN old\_name TO new\_name;  
\-- Queries viejas con old\_name fallan inmediatamente  
\`\`\`

\*\*✅ BIEN \- Zero-downtime approach (4 pasos):\*\*  
\`\`\`sql  
\-- Migration 1: Agregar columna nueva  
ALTER TABLE customers ADD COLUMN new\_name TEXT;

\-- Migration 2: Copiar data de vieja a nueva  
UPDATE customers SET new\_name \= old\_name WHERE new\_name IS NULL;

\-- Migration 3: (Después de deploy de código que usa new\_name)  
\-- Hacer nueva columna NOT NULL  
ALTER TABLE customers ALTER COLUMN new\_name SET NOT NULL;

\-- Migration 4: (Mucho después, cuando old\_name ya no se usa)  
\-- Eliminar columna vieja  
ALTER TABLE customers DROP COLUMN old\_name;  
\`\`\`

\*\*Caso: Cambiar tipo de columna (TEXT → UUID)\*\*  
\`\`\`sql  
\-- Zero-downtime approach

\-- Paso 1: Agregar columna nueva  
ALTER TABLE orders ADD COLUMN customer\_id\_uuid UUID;

\-- Paso 2: Poblar nueva columna  
UPDATE orders   
SET customer\_id\_uuid \= customer\_id::uuid  
WHERE customer\_id\_uuid IS NULL;

\-- Paso 3: Crear index en nueva columna  
CREATE INDEX idx\_orders\_customer\_uuid ON orders(customer\_id\_uuid);

\-- Paso 4: (Después de deploy) Hacer NOT NULL  
ALTER TABLE orders ALTER COLUMN customer\_id\_uuid SET NOT NULL;

\-- Paso 5: (Después de validar) Drop columna vieja  
ALTER TABLE orders DROP COLUMN customer\_id;

\-- Paso 6: Renombrar nueva columna  
ALTER TABLE orders RENAME COLUMN customer\_id\_uuid TO customer\_id;  
\`\`\`

\#\#\# Práctica 4: Testing de Migrations en Staging

\*\*Script de testing: \`test\_migration.sh\`\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Testing de migration en staging

MIGRATION\_FILE=$1  
ROLLBACK\_FILE=$2

if \[ \-z "$MIGRATION\_FILE" \] || \[ \-z "$ROLLBACK\_FILE" \]; then  
    echo "Usage: ./test\_migration.sh migration.sql rollback.sql"  
    exit 1  
fi

echo "🧪 TESTING MIGRATION: $MIGRATION\_FILE"  
echo "======================================="  
echo ""

\# 1\. Backup de staging  
echo "📦 Step 1: Crear backup de staging..."  
pg\_dump $STAGING\_DB\_URL \> backup\_before\_migration.sql  
echo "✅ Backup creado: backup\_before\_migration.sql"  
echo ""

\# 2\. Ejecutar migration  
echo "⬆️  Step 2: Ejecutar migration..."  
psql $STAGING\_DB\_URL \-f $MIGRATION\_FILE

if \[ $? \-ne 0 \]; then  
    echo "❌ Migration FALLÓ"  
    echo "Restaurando desde backup..."  
    psql $STAGING\_DB\_URL \< backup\_before\_migration.sql  
    exit 1  
fi

echo "✅ Migration ejecutada exitosamente"  
echo ""

\# 3\. Verificar que app funciona  
echo "🔍 Step 3: Testing de aplicación..."  
echo "   → Login de usuario: ..."  
echo "   → Lectura de customers: ..."  
echo "   → Creación de prediction: ..."  
echo ""  
read \-p "¿La app funciona correctamente? (y/n): " APP\_WORKS

if \[ "$APP\_WORKS" \!= "y" \]; then  
    echo "❌ App NO funciona \- Ejecutando rollback..."  
    psql $STAGING\_DB\_URL \-f $ROLLBACK\_FILE  
    echo "✅ Rollback ejecutado"  
    exit 1  
fi

echo "✅ App funciona OK"  
echo ""

\# 4\. Testing de rollback  
echo "⬇️  Step 4: Testing de rollback..."  
psql $STAGING\_DB\_URL \-f $ROLLBACK\_FILE

if \[ $? \-ne 0 \]; then  
    echo "❌ Rollback FALLÓ (problema serio)"  
    exit 1  
fi

echo "✅ Rollback ejecutado exitosamente"  
echo ""

\# 5\. Re-aplicar migration  
echo "⬆️  Step 5: Re-aplicar migration..."  
psql $STAGING\_DB\_URL \-f $MIGRATION\_FILE

if \[ $? \-ne 0 \]; then  
    echo "❌ Re-aplicación de migration FALLÓ"  
    exit 1  
fi

echo "✅ Migration re-aplicada exitosamente"  
echo ""

\# 6\. Resumen  
echo "🎉 TESTING COMPLETO"  
echo "=================="  
echo "✅ Migration funciona"  
echo "✅ App funciona post-migration"  
echo "✅ Rollback funciona"  
echo "✅ Migration es idempotente (se puede re-aplicar)"  
echo ""  
echo "👉 LISTO PARA PRODUCCIÓN"  
\`\`\`

\*\*Uso:\*\*  
\`\`\`bash  
chmod \+x test\_migration.sh

\# Testear migration  
./test\_migration.sh \\  
    migrations/006\_add\_predictions.sql \\  
    migrations/006\_rollback.sql  
\`\`\`

\#\#\# Práctica 5: Migration Tracking

\*\*Tabla de migrations:\*\*  
\`\`\`sql  
\-- Tabla para trackear qué migrations se aplicaron  
CREATE TABLE IF NOT EXISTS schema\_migrations (  
    id SERIAL PRIMARY KEY,  
    migration\_file TEXT NOT NULL UNIQUE,  
    applied\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    applied\_by TEXT,  
    rollback\_file TEXT,  
    description TEXT  
);

\-- Agregar entry al aplicar migration  
INSERT INTO schema\_migrations (migration\_file, rollback\_file, description, applied\_by)  
VALUES (  
    '001\_create\_customers.sql',  
    '001\_rollback.sql',  
    'Crear tabla customers con RLS',  
    current\_user  
);

\-- Ver historial de migrations  
SELECT   
    migration\_file,  
    description,  
    applied\_at,  
    applied\_by  
FROM schema\_migrations  
ORDER BY id;  
\`\`\`

\*\*Script helper: \`apply\_migration.sh\`\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Aplicar migration con tracking automático

MIGRATION\_FILE=$1

if \[ \-z "$MIGRATION\_FILE" \]; then  
    echo "Usage: ./apply\_migration.sh migration.sql"  
    exit 1  
fi

\# Extraer nombre sin path  
MIGRATION\_NAME=$(basename $MIGRATION\_FILE)  
ROLLBACK\_FILE="${MIGRATION\_NAME%.\*}\_rollback.sql"

\# Verificar que no se aplicó antes  
ALREADY\_APPLIED=$(psql $DATABASE\_URL \-t \-c \\  
    "SELECT COUNT(\*) FROM schema\_migrations WHERE migration\_file \= '$MIGRATION\_NAME'")

if \[ "$ALREADY\_APPLIED" \-gt 0 \]; then  
    echo "⚠️  Migration $MIGRATION\_NAME ya fue aplicada"  
    exit 1  
fi

\# Aplicar migration  
echo "⬆️  Aplicando migration: $MIGRATION\_NAME"  
psql $DATABASE\_URL \-f $MIGRATION\_FILE

if \[ $? \-ne 0 \]; then  
    echo "❌ Migration falló"  
    exit 1  
fi

\# Registrar en schema\_migrations  
psql $DATABASE\_URL \-c \\  
    "INSERT INTO schema\_migrations (migration\_file, rollback\_file)   
     VALUES ('$MIGRATION\_NAME', '$ROLLBACK\_FILE')"

echo "✅ Migration aplicada y registrada"  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Migration Completa (Customers)

\*\*Archivo: \`001\_create\_customers.sql\`\*\*  
\`\`\`sql  
\-- Migration: 001\_create\_customers.sql  
\-- Description: Crear tabla customers con RLS completo  
\-- Author: Pato  
\-- Date: 2025-02-16  
\-- Dependencies: Requiere tabla tenants

BEGIN;

\-- Verificar prerequisitos  
DO $$  
BEGIN  
    IF NOT EXISTS (SELECT 1 FROM pg\_tables WHERE tablename \= 'tenants') THEN  
        RAISE EXCEPTION 'Cannot create customers: table tenants does not exist';  
    END IF;  
END $$;

\-- Crear tabla  
CREATE TABLE customers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    name TEXT NOT NULL,  
    email TEXT NOT NULL,  
    phone TEXT,  
      
    status TEXT NOT NULL DEFAULT 'active' CHECK (  
        status IN ('active', 'inactive', 'suspended')  
    ),  
      
    last\_purchase\_date DATE,  
    total\_purchases\_amount DECIMAL(12, 2\) DEFAULT 0 CHECK (  
        total\_purchases\_amount \>= 0  
    ),  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    CONSTRAINT unique\_email\_per\_tenant UNIQUE (tenant\_id, email)  
);

\-- Indexes  
CREATE INDEX idx\_customers\_tenant\_id ON customers(tenant\_id);  
CREATE INDEX idx\_customers\_email ON customers(email);  
CREATE INDEX idx\_customers\_status ON customers(tenant\_id, status);  
CREATE INDEX idx\_customers\_last\_purchase   
    ON customers(last\_purchase\_date DESC)   
    WHERE status \= 'active';

\-- Trigger  
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

\-- Comentarios  
COMMENT ON TABLE customers IS 'Clientes de distribuidores B2B (multi-tenant)';  
COMMENT ON COLUMN customers.total\_purchases\_amount IS 'Suma total histórica de compras';

COMMIT;

\-- Verificación  
DO $$  
DECLARE  
    table\_count INTEGER;  
    index\_count INTEGER;  
    policy\_count INTEGER;  
BEGIN  
    SELECT COUNT(\*) INTO table\_count   
    FROM pg\_tables   
    WHERE tablename \= 'customers';  
      
    SELECT COUNT(\*) INTO index\_count   
    FROM pg\_indexes   
    WHERE tablename \= 'customers';  
      
    SELECT COUNT(\*) INTO policy\_count   
    FROM pg\_policies   
    WHERE tablename \= 'customers';  
      
    IF table\_count \= 0 THEN  
        RAISE EXCEPTION 'Verification failed: table not created';  
    END IF;  
      
    IF index\_count \< 4 THEN  
        RAISE EXCEPTION 'Verification failed: missing indexes (found %, expected 4)', index\_count;  
    END IF;  
      
    IF policy\_count \= 0 THEN  
        RAISE EXCEPTION 'Verification failed: RLS policy not created';  
    END IF;  
      
    RAISE NOTICE '✅ Migration 001 verified successfully';  
    RAISE NOTICE '   \- Table: customers created';  
    RAISE NOTICE '   \- Indexes: % created', index\_count;  
    RAISE NOTICE '   \- RLS policies: % created', policy\_count;  
END $$;  
\`\`\`

\*\*Archivo: \`001\_rollback.sql\`\*\*  
\`\`\`sql  
\-- Rollback: 001\_rollback.sql  
\-- Description: Revertir creación de tabla customers

BEGIN;

\-- Verificar que tabla existe antes de intentar drop  
DO $$  
BEGIN  
    IF NOT EXISTS (SELECT 1 FROM pg\_tables WHERE tablename \= 'customers') THEN  
        RAISE NOTICE 'Table customers does not exist, nothing to rollback';  
    END IF;  
END $$;

\-- Drop en orden inverso  
DROP POLICY IF EXISTS tenant\_isolation\_policy ON customers;  
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;  
DROP TRIGGER IF EXISTS set\_updated\_at ON customers;  
DROP INDEX IF EXISTS idx\_customers\_tenant\_id;  
DROP INDEX IF EXISTS idx\_customers\_email;  
DROP INDEX IF EXISTS idx\_customers\_status;  
DROP INDEX IF EXISTS idx\_customers\_last\_purchase;  
DROP TABLE IF EXISTS customers CASCADE;

COMMIT;

\-- Verificación  
DO $$  
BEGIN  
    IF EXISTS (SELECT 1 FROM pg\_tables WHERE tablename \= 'customers') THEN  
        RAISE EXCEPTION 'Rollback failed: table customers still exists';  
    END IF;  
      
    RAISE NOTICE '✅ Rollback 001 completed successfully';  
END $$;  
\`\`\`

\#\#\# Ejemplo 2: Migration de Modificación (Agregar Columna)

\*\*Archivo: \`007\_add\_customer\_tier.sql\`\*\*  
\`\`\`sql  
\-- Migration: 007\_add\_customer\_tier.sql  
\-- Description: Agregar sistema de tiers a customers  
\-- Author: Pato  
\-- Date: 2025-02-16

BEGIN;

\-- 1\. Agregar columna (nullable inicialmente)  
ALTER TABLE customers   
ADD COLUMN tier TEXT;

\-- 2\. Poblar con valores calculados  
UPDATE customers  
SET tier \= CASE  
    WHEN total\_purchases\_amount \>= 1000000 THEN 'gold'  
    WHEN total\_purchases\_amount \>= 500000 THEN 'silver'  
    ELSE 'bronze'  
END  
WHERE tier IS NULL;

\-- 3\. Hacer NOT NULL con default  
ALTER TABLE customers  
ALTER COLUMN tier SET NOT NULL,  
ALTER COLUMN tier SET DEFAULT 'bronze';

\-- 4\. Agregar constraint  
ALTER TABLE customers  
ADD CONSTRAINT check\_customer\_tier CHECK (  
    tier IN ('bronze', 'silver', 'gold')  
);

\-- 5\. Agregar index para queries por tier  
CREATE INDEX idx\_customers\_tier ON customers(tenant\_id, tier);

\-- 6\. Comentario  
COMMENT ON COLUMN customers.tier IS 'Tier del customer: bronze (\<500K), silver (500K-1M), gold (\>1M)';

COMMIT;

\-- Verificación  
DO $$  
DECLARE  
    null\_count INTEGER;  
    tier\_distribution RECORD;  
BEGIN  
    \-- Verificar que no hay NULLs  
    SELECT COUNT(\*) INTO null\_count   
    FROM customers   
    WHERE tier IS NULL;  
      
    IF null\_count \> 0 THEN  
        RAISE EXCEPTION 'Migration failed: % customers have NULL tier', null\_count;  
    END IF;  
      
    \-- Mostrar distribución de tiers  
    FOR tier\_distribution IN   
        SELECT tier, COUNT(\*) as count   
        FROM customers   
        GROUP BY tier   
        ORDER BY tier  
    LOOP  
        RAISE NOTICE '   Tier %: % customers', tier\_distribution.tier, tier\_distribution.count;  
    END LOOP;  
      
    RAISE NOTICE '✅ Migration 007 completed successfully';  
END $$;  
\`\`\`

\*\*Archivo: \`007\_rollback.sql\`\*\*  
\`\`\`sql  
\-- Rollback: 007\_rollback.sql

BEGIN;

\-- Drop index  
DROP INDEX IF EXISTS idx\_customers\_tier;

\-- Drop constraint (PostgreSQL lo maneja al drop column, pero explícito es mejor)  
ALTER TABLE customers DROP CONSTRAINT IF EXISTS check\_customer\_tier;

\-- Drop columna  
ALTER TABLE customers DROP COLUMN IF EXISTS tier;

COMMIT;

\-- Verificación  
DO $$  
BEGIN  
    IF EXISTS (  
        SELECT 1 FROM information\_schema.columns   
        WHERE table\_name \= 'customers' AND column\_name \= 'tier'  
    ) THEN  
        RAISE EXCEPTION 'Rollback failed: column tier still exists';  
    END IF;  
      
    RAISE NOTICE '✅ Rollback 007 completed successfully';  
END $$;  
\`\`\`

\#\#\# Ejemplo 3: Migration de Performance (Agregar Index)

\*\*Archivo: \`008\_add\_performance\_indexes.sql\`\*\*  
\`\`\`sql  
\-- Migration: 008\_add\_performance\_indexes.sql  
\-- Description: Agregar indexes para optimizar queries lentas  
\-- Author: Pato  
\-- Date: 2025-02-16  
\-- Context: Dashboard loading slow (3+ seconds)

BEGIN;

\-- 1\. Index compuesto para query de dashboard  
\-- Query: SELECT \* FROM predictions WHERE tenant\_id \= X AND status \= 'pending' ORDER BY created\_at DESC  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx\_predictions\_dashboard   
    ON predictions(tenant\_id, status, created\_at DESC)  
    WHERE status \= 'pending';  
\-- CONCURRENTLY permite crear index sin bloquear tabla

\-- 2\. Partial index para customers activos con compras recientes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx\_customers\_recent\_active  
    ON customers(tenant\_id, last\_purchase\_date DESC)  
    WHERE status \= 'active' AND last\_purchase\_date \> NOW() \- INTERVAL '6 months';

\-- 3\. Index para búsqueda de productos por nombre  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx\_products\_name\_search  
    ON products USING gin(to\_tsvector('spanish', name));  
\-- GIN index para full-text search en español

COMMIT;

\-- Verificación  
DO $$  
DECLARE  
    idx\_count INTEGER;  
BEGIN  
    SELECT COUNT(\*) INTO idx\_count  
    FROM pg\_indexes  
    WHERE tablename IN ('predictions', 'customers', 'products')  
    AND indexname LIKE 'idx\_%dashboard%' OR indexname LIKE 'idx\_%recent%' OR indexname LIKE 'idx\_%search%';  
      
    IF idx\_count \< 3 THEN  
        RAISE EXCEPTION 'Migration failed: expected 3 indexes, found %', idx\_count;  
    END IF;  
      
    RAISE NOTICE '✅ Migration 008 completed \- % performance indexes added', idx\_count;  
END $$;  
\`\`\`

\*\*Archivo: \`008\_rollback.sql\`\*\*  
\`\`\`sql  
\-- Rollback: 008\_rollback.sql

BEGIN;

DROP INDEX CONCURRENTLY IF EXISTS idx\_predictions\_dashboard;  
DROP INDEX CONCURRENTLY IF EXISTS idx\_customers\_recent\_active;  
DROP INDEX CONCURRENTLY IF EXISTS idx\_products\_name\_search;

COMMIT;

RAISE NOTICE '✅ Rollback 008 completed \- performance indexes removed';  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: Migration sin Rollback  
\`\`\`sql  
\-- ❌ MAL \- Solo migration, sin rollback  
migrations/  
├── 001\_create\_customers.sql  
└── 002\_create\_products.sql

\-- ✅ BIEN \- Cada migration con su rollback  
migrations/  
├── 001\_create\_customers.sql  
├── 001\_rollback.sql  
├── 002\_create\_products.sql  
└── 002\_rollback.sql  
\`\`\`

\#\#\# Error 2: No usar Transacciones  
\`\`\`sql  
\-- ❌ MAL \- Sin BEGIN/COMMIT  
CREATE TABLE customers (...);  
CREATE INDEX idx\_customers\_tenant ON customers(tenant\_id);  
\-- Si el index falla, la tabla queda creada (estado inconsistente)

\-- ✅ BIEN \- Con transacción  
BEGIN;  
CREATE TABLE customers (...);  
CREATE INDEX idx\_customers\_tenant ON customers(tenant\_id);  
COMMIT;  
\-- Si algo falla, NADA se aplica (all or nothing)  
\`\`\`

\#\#\# Error 3: Olvidar Dependencies  
\`\`\`sql  
\-- ❌ MAL \- Crear customers antes que tenants  
\-- 001\_create\_customers.sql  
CREATE TABLE customers (  
    tenant\_id UUID REFERENCES tenants(id)  \-- tenants no existe aún\!  
);

\-- ✅ BIEN \- Orden correcto  
\-- 001\_create\_tenants.sql (primero)  
\-- 002\_create\_customers.sql (después)  
\`\`\`

\#\#\# Error 4: Migrations No Idempotentes  
\`\`\`sql  
\-- ❌ MAL \- Falla si se ejecuta 2 veces  
CREATE TABLE customers (...);  
\-- ERROR: relation "customers" already exists

\-- ✅ BIEN \- Idempotente (safe para re-ejecutar)  
CREATE TABLE IF NOT EXISTS customers (...);  
\`\`\`

\#\#\# Error 5: No Testear en Staging  
\`\`\`bash  
\# ❌ MAL  
psql $PRODUCTION\_DB \-f migration.sql  
\# Directo a producción sin testear

\# ✅ BIEN  
\# 1\. Testear en staging  
psql $STAGING\_DB \-f migration.sql  
\# 2\. Validar que app funciona  
\# 3\. Testear rollback  
psql $STAGING\_DB \-f rollback.sql  
\# 4\. SOLO DESPUÉS aplicar en producción  
psql $PRODUCTION\_DB \-f migration.sql  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Antes de Crear Migration  
\- \[ \] Entiendo QUÉ hace la migration  
\- \[ \] Entiendo POR QUÉ es necesaria  
\- \[ \] Revisé si hay approach alternativo sin migration  
\- \[ \] Documenté dependencies (qué migrations deben existir antes)

\#\#\# Estructura de Migration  
\- \[ \] Archivo de migration (.sql)  
\- \[ \] Archivo de rollback (.sql)  
\- \[ \] Wrapped en BEGIN/COMMIT  
\- \[ \] Comentarios explicativos  
\- \[ \] Verificación post-migration  
\- \[ \] Idempotente (safe para re-ejecutar)

\#\#\# Testing  
\- \[ \] Testeada en staging con datos reales  
\- \[ \] App funciona post-migration  
\- \[ \] Rollback testeado  
\- \[ \] Migration re-aplicada post-rollback  
\- \[ \] Performance medida (queries afectadas)

\#\#\# Deployment  
\- \[ \] Backup de producción creado  
\- \[ \] Migration ejecutada en producción  
\- \[ \] Verificación post-deployment  
\- \[ \] Registrada en schema\_migrations  
\- \[ \] Rollback listo si hay problemas

\---

\#\# 📊 Métricas de Éxito

Migrations seguras si:  
\- ✅ 100% de migrations tienen rollback  
\- ✅ 0 migrations aplicadas sin testing en staging  
\- ✅ 100% de migrations son idempotentes  
\- ✅ 0 downtime en producción  
\- ✅ Rollback funciona en \<1 minuto si es necesario

\---

\#\# 💡 Para Pato (Workflow Completo)

\#\#\# Crear nueva migration  
\`\`\`bash  
\# 1\. Crear archivos  
cd /home/pato/pymepilot-core/migrations

\# Obtener próximo número  
NEXT\_NUM=$(ls \-1 \*.sql | grep \-o '^\[0-9\]\*' | sort \-n | tail \-1)  
NEXT\_NUM=$((NEXT\_NUM \+ 1))  
NEXT\_NUM=$(printf "%03d" $NEXT\_NUM)

\# Crear archivos  
touch ${NEXT\_NUM}\_nombre\_descriptivo.sql  
touch ${NEXT\_NUM}\_rollback.sql

\# 2\. Escribir migration con template  
nano ${NEXT\_NUM}\_nombre\_descriptivo.sql  
\`\`\`

\#\#\# Testear migration  
\`\`\`bash  
\# 1\. Backup  
pg\_dump $STAGING\_DB\_URL \> backup\_before\_migration.sql

\# 2\. Aplicar  
psql $STAGING\_DB\_URL \-f ${NEXT\_NUM}\_nombre\_descriptivo.sql

\# 3\. Testear app  
\# ... navegar dashboard, probar features afectadas

\# 4\. Testear rollback  
psql $STAGING\_DB\_URL \-f ${NEXT\_NUM}\_rollback.sql

\# 5\. Re-aplicar  
psql $STAGING\_DB\_URL \-f ${NEXT\_NUM}\_nombre\_descriptivo.sql  
\`\`\`

\#\#\# Aplicar en producción  
\`\`\`bash  
\# 1\. Backup  
pg\_dump $PRODUCTION\_DB\_URL \> backup\_production\_$(date \+%Y%m%d\_%H%M%S).sql

\# 2\. Aplicar migration  
psql $PRODUCTION\_DB\_URL \-f ${NEXT\_NUM}\_nombre\_descriptivo.sql

\# 3\. Verificar  
psql $PRODUCTION\_DB\_URL \-c "SELECT \* FROM schema\_migrations ORDER BY id DESC LIMIT 1"

\# 4\. Si algo falla  
psql $PRODUCTION\_DB\_URL \-f ${NEXT\_NUM}\_rollback.sql  
\`\`\`

\#\#\# Comandos útiles  
\`\`\`bash  
\# Ver migrations aplicadas  
psql $DATABASE\_URL \-c "SELECT migration\_file, applied\_at FROM schema\_migrations ORDER BY id"

\# Ver estructura de tabla  
psql $DATABASE\_URL \-c "\\d customers"

\# Ver indexes de tabla  
psql $DATABASE\_URL \-c "\\di customers"

\# Ver policies (RLS)  
psql $DATABASE\_URL \-c "\\d customers" | grep \-A 10 "Policies"  
\`\`\`

\---  
