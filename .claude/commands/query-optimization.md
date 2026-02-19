---
name: query-optimization
description: EXPLAIN ANALYZE y optimizacion de queries PostgreSQL
---

\# Skill: Query Optimization

\#\# 🎯 Qué es  
Guía completa para optimizar queries de PostgreSQL en PymePilot. Cubre análisis de EXPLAIN, creación de indexes estratégicos, identificación de N+1 queries, y técnicas de optimización para arquitectura multi-tenant.

\*\*Analogía Simple:\*\*  
Una query lenta es como buscar una persona específica en un estadio lleno:  
\- Sin index \= revisar persona por persona (lento)  
\- Con index \= ir directo a la sección correcta (rápido)  
\- Query mal escrita \= dar vueltas innecesarias  
\- Query optimizada \= camino más corto al objetivo

En PostgreSQL:  
\- EXPLAIN ANALYZE muestra cómo se ejecuta la query  
\- Indexes aceleran búsquedas y filtrados  
\- Queries bien escritas usan menos recursos  
\- Multi-tenant requiere optimizaciones especiales

\*\*Por qué es CRÍTICO para PymePilot:\*\*  
\- Dashboard debe cargar en \<1 segundo  
\- Verticales de IA procesan miles de customers  
\- Queries lentas \= mala experiencia para IEY  
\- Optimización \= menos costo de servidor

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Query tarda \>100ms  
\- ✅ Antes de crear index nuevo  
\- ✅ Al agregar query nueva a código  
\- ✅ Después de migration que modifica estructura

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Dashboard/página carga lento  
\- ⚠️ Query procesa muchas rows (1000+)  
\- ⚠️ Query tiene múltiples JOINs  
\- ⚠️ Detectás N+1 problem en logs

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Usar EXPLAIN ANALYZE

\*\*Comandos básicos:\*\*  
\`\`\`sql  
\-- EXPLAIN: Plan de ejecución (NO ejecuta la query)  
EXPLAIN SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey';

\-- EXPLAIN ANALYZE: Plan \+ ejecución REAL (con tiempos)  
EXPLAIN ANALYZE SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey';

\-- EXPLAIN con opciones avanzadas  
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS)  
SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey';  
\`\`\`

\*\*Leer output de EXPLAIN:\*\*  
\`\`\`sql  
EXPLAIN ANALYZE   
SELECT \* FROM customers   
WHERE tenant\_id \= '123e4567-e89b-12d3-a456-426614174000'  
AND status \= 'active';

\-- Output:  
Bitmap Heap Scan on customers  (cost=4.32..15.84 rows=5 width=100) (actual time=0.025..0.028 rows=3 loops=1)  
  Recheck Cond: (tenant\_id \= '123e4567-e89b-12d3-a456-426614174000'::uuid)  
  Filter: (status \= 'active'::text)  
  Rows Removed by Filter: 2  
  Heap Blocks: exact=1  
  \-\>  Bitmap Index Scan on idx\_customers\_tenant\_id  (cost=0.00..4.32 rows=7 width=0) (actual time=0.015..0.015 rows=5 loops=1)  
        Index Cond: (tenant\_id \= '123e4567-e89b-12d3-a456-426614174000'::uuid)  
Planning Time: 0.145 ms  
Execution Time: 0.055 ms  
\`\`\`

\*\*Qué significa cada parte:\*\*  
\`\`\`  
Bitmap Heap Scan on customers  
  └─ Método de scan: usa index \+ heap  
    
cost=4.32..15.84  
  └─ Costo estimado (unidades arbitrarias)  
    
rows=5  
  └─ Rows esperadas (estimación)  
    
actual time=0.025..0.028  
  └─ Tiempo REAL en milisegundos  
    
rows=3  
  └─ Rows REALES retornadas  
    
loops=1  
  └─ Cuántas veces se ejecutó este nodo  
    
Bitmap Index Scan on idx\_customers\_tenant\_id  
  └─ Usó este index  
    
Planning Time: 0.145 ms  
  └─ Tiempo de planificación  
    
Execution Time: 0.055 ms  
  └─ Tiempo de ejecución TOTAL  
\`\`\`

\*\*Señales de alerta en EXPLAIN:\*\*  
\`\`\`sql  
\-- 🚨 Seq Scan (full table scan) en tabla grande  
Seq Scan on customers  (cost=0.00..10000.00 rows=100000 width=100)  
\-- PROBLEMA: No está usando index  
\-- FIX: Agregar index en columna de filtrado

\-- 🚨 Nested Loop con muchas iteraciones  
Nested Loop  (cost=0.00..50000.00 rows=10000 width=200)  
  \-\>  Seq Scan on customers  (cost=0.00..1000.00 rows=100 width=100)  
  \-\>  Seq Scan on orders  (cost=0.00..490.00 rows=100 width=100) (loops=100)  
\-- PROBLEMA: Nested loop ejecutándose 100 veces  
\-- FIX: Agregar index en join key

\-- 🚨 Estimación muy diferente de realidad  
rows=5 (actual rows=5000)  
\-- PROBLEMA: Estadísticas desactualizadas  
\-- FIX: ANALYZE tabla

\-- 🚨 Tiempo de ejecución alto  
Execution Time: 3500.123 ms  
\-- PROBLEMA: Query tarda 3.5 segundos  
\-- FIX: Optimizar query o agregar indexes  
\`\`\`

\#\#\# Práctica 2: Crear Indexes Estratégicos

\*\*Reglas para decidir si crear index:\*\*  
\`\`\`sql  
\-- ✅ CREAR index si:  
\-- 1\. Columna en WHERE frecuentemente  
SELECT \* FROM customers WHERE status \= 'active';  
CREATE INDEX idx\_customers\_status ON customers(status);

\-- 2\. Columna en JOIN  
SELECT \* FROM orders o JOIN customers c ON o.customer\_id \= c.id;  
CREATE INDEX idx\_orders\_customer\_id ON orders(customer\_id);

\-- 3\. Columna en ORDER BY  
SELECT \* FROM customers ORDER BY last\_purchase\_date DESC;  
CREATE INDEX idx\_customers\_last\_purchase ON customers(last\_purchase\_date DESC);

\-- 4\. Combinación de columnas usadas juntas  
SELECT \* FROM customers WHERE tenant\_id \= X AND status \= 'active';  
CREATE INDEX idx\_customers\_tenant\_status ON customers(tenant\_id, status);

\-- ❌ NO crear index si:  
\-- 1\. Tabla muy pequeña (\<1000 rows)  
\-- 2\. Columna cambia frecuentemente (más writes que reads)  
\-- 3\. Columna con baja cardinalidad (ej: boolean)  
\-- 4\. Index ocuparía más que la tabla  
\`\`\`

\*\*Tipos de indexes:\*\*  
\`\`\`sql  
\-- 1\. B-tree (default, 99% de casos)  
CREATE INDEX idx\_customers\_email ON customers(email);

\-- 2\. Partial index (solo subset de rows)  
CREATE INDEX idx\_active\_customers   
    ON customers(tenant\_id, last\_purchase\_date)  
    WHERE status \= 'active';  
\-- Más pequeño y rápido que indexar toda la tabla

\-- 3\. Composite index (múltiples columnas)  
CREATE INDEX idx\_customers\_tenant\_status\_date   
    ON customers(tenant\_id, status, last\_purchase\_date DESC);  
\-- Orden importa: tenant\_id primero (más selectivo)

\-- 4\. Expression index (función sobre columna)  
CREATE INDEX idx\_customers\_email\_lower   
    ON customers(LOWER(email));  
\-- Para búsquedas case-insensitive

\-- 5\. GIN index (para JSONB, arrays, full-text)  
CREATE INDEX idx\_customers\_metadata   
    ON customers USING GIN(metadata);  
\`\`\`

\*\*Index covering (incluir columnas):\*\*  
\`\`\`sql  
\-- Query frecuente:  
SELECT id, name, email   
FROM customers   
WHERE tenant\_id \= X AND status \= 'active';

\-- Index que cubre TODO (no necesita ir al heap)  
CREATE INDEX idx\_customers\_covering   
    ON customers(tenant\_id, status)   
    INCLUDE (id, name, email);  
\-- PostgreSQL 11+  
\`\`\`

\#\#\# Práctica 3: Optimizar Queries Multi-Tenant

\*\*Patrón 1: Tenant primero en composite index\*\*  
\`\`\`sql  
\-- ❌ MAL \- Index sin tenant\_id  
CREATE INDEX idx\_customers\_status ON customers(status);

SELECT \* FROM customers   
WHERE tenant\_id \= 'uuid-iey' AND status \= 'active';  
\-- Escanea TODOS los customers con status=active (de todos los tenants)  
\-- Luego filtra por tenant\_id

\-- ✅ BIEN \- Tenant primero  
CREATE INDEX idx\_customers\_tenant\_status ON customers(tenant\_id, status);

SELECT \* FROM customers   
WHERE tenant\_id \= 'uuid-iey' AND status \= 'active';  
\-- Va directo a customers de IEY, luego filtra por status  
\`\`\`

\*\*Patrón 2: RLS \+ Index \= Performance\*\*  
\`\`\`sql  
\-- Con RLS habilitado:  
SET app.tenant\_id \= 'uuid-iey';

\-- Query sin WHERE tenant\_id explícito  
SELECT \* FROM customers WHERE status \= 'active';

\-- RLS agrega automáticamente:  
\-- WHERE tenant\_id \= 'uuid-iey' AND status \= 'active'

\-- Para que sea rápida, necesitás:  
CREATE INDEX idx\_customers\_tenant\_status ON customers(tenant\_id, status);  
\`\`\`

\*\*Patrón 3: Evitar OR en multi-tenant\*\*  
\`\`\`sql  
\-- ❌ MAL \- OR dificulta uso de index  
SELECT \* FROM customers  
WHERE tenant\_id \= 'uuid-iey'  
AND (status \= 'active' OR status \= 'inactive');

\-- ✅ BIEN \- IN es más eficiente  
SELECT \* FROM customers  
WHERE tenant\_id \= 'uuid-iey'  
AND status IN ('active', 'inactive');

\-- ✅ AÚN MEJOR \- Si necesitás ambos, no filtres  
SELECT \* FROM customers  
WHERE tenant\_id \= 'uuid-iey';  
\-- Filtrá en aplicación si es necesario  
\`\`\`

\#\#\# Práctica 4: Identificar y Resolver N+1 Queries

\*\*Qué es N+1 Problem:\*\*  
\`\`\`python  
\# ❌ MAL \- N+1 queries  
\# 1 query para customers  
customers \= db.execute("SELECT \* FROM customers WHERE tenant\_id \= %s", (tenant\_id,))

\# N queries (1 por customer)  
for customer in customers:  
    orders \= db.execute(  
        "SELECT \* FROM orders WHERE customer\_id \= %s",  
        (customer\['id'\],)  
    )  
    customer\['orders'\] \= orders

\# Si hay 100 customers → 101 queries total (lento)  
\`\`\`

\*\*Solución 1: JOIN\*\*  
\`\`\`python  
\# ✅ BIEN \- 1 query con JOIN  
result \= db.execute("""  
    SELECT   
        c.\*,  
        json\_agg(o.\*) as orders  
    FROM customers c  
    LEFT JOIN orders o ON c.id \= o.customer\_id  
    WHERE c.tenant\_id \= %s  
    GROUP BY c.id  
""", (tenant\_id,))

\# Solo 1 query, todo en un viaje a DB  
\`\`\`

\*\*Solución 2: IN clause\*\*  
\`\`\`python  
\# ✅ BIEN \- 2 queries (1 para customers, 1 para todos los orders)  
customers \= db.execute(  
    "SELECT \* FROM customers WHERE tenant\_id \= %s",  
    (tenant\_id,)  
)

customer\_ids \= \[c\['id'\] for c in customers\]

orders \= db.execute(  
    "SELECT \* FROM orders WHERE customer\_id \= ANY(%s)",  
    (customer\_ids,)  
)

\# Agrupar orders por customer\_id en aplicación  
orders\_by\_customer \= {}  
for order in orders:  
    customer\_id \= order\['customer\_id'\]  
    if customer\_id not in orders\_by\_customer:  
        orders\_by\_customer\[customer\_id\] \= \[\]  
    orders\_by\_customer\[customer\_id\].append(order)

\# Asignar a customers  
for customer in customers:  
    customer\['orders'\] \= orders\_by\_customer.get(customer\['id'\], \[\])

\# Solo 2 queries, mucho mejor que 101  
\`\`\`

\*\*Detectar N+1 en logs:\*\*  
\`\`\`python  
\# Habilitar logging de queries  
import logging  
logging.basicConfig(level=logging.DEBUG)

\# Si ves esto en logs:  
\# SELECT \* FROM customers WHERE tenant\_id \= ...  
\# SELECT \* FROM orders WHERE customer\_id \= 1  
\# SELECT \* FROM orders WHERE customer\_id \= 2  
\# SELECT \* FROM orders WHERE customer\_id \= 3  
\# ...  
\# → N+1 problem detectado  
\`\`\`

\#\#\# Práctica 5: Caching y Materialized Views

\*\*Caso: KPIs calculados frecuentemente\*\*  
\`\`\`sql  
\-- Query lenta (2+ segundos):  
SELECT   
    COUNT(\*) as total\_customers,  
    COUNT(\*) FILTER (WHERE status \= 'active') as active\_customers,  
    AVG(total\_purchases\_amount) as avg\_purchases,  
    SUM(total\_purchases\_amount) as total\_revenue  
FROM customers  
WHERE tenant\_id \= 'uuid-iey';

\-- Si se calcula frecuentemente (dashboard), usar materialized view:  
CREATE MATERIALIZED VIEW customer\_kpis AS  
SELECT   
    tenant\_id,  
    COUNT(\*) as total\_customers,  
    COUNT(\*) FILTER (WHERE status \= 'active') as active\_customers,  
    AVG(total\_purchases\_amount) as avg\_purchases,  
    SUM(total\_purchases\_amount) as total\_revenue,  
    NOW() as last\_updated  
FROM customers  
GROUP BY tenant\_id;

\-- Index en materialized view  
CREATE INDEX idx\_customer\_kpis\_tenant ON customer\_kpis(tenant\_id);

\-- Query rápida (\<10ms):  
SELECT \* FROM customer\_kpis WHERE tenant\_id \= 'uuid-iey';

\-- Refresh periódico (cron job cada hora):  
REFRESH MATERIALIZED VIEW CONCURRENTLY customer\_kpis;  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Optimizar Query de Dashboard

\*\*Query original (lenta \- 3.5 segundos):\*\*  
\`\`\`sql  
\-- Query de dashboard: TOP customers por gasto  
SELECT   
    c.name,  
    c.email,  
    COUNT(o.id) as order\_count,  
    SUM(o.total) as total\_spent  
FROM customers c  
LEFT JOIN orders o ON c.id \= o.customer\_id  
WHERE c.tenant\_id \= '123e4567-e89b-12d3-a456-426614174000'  
AND c.status \= 'active'  
GROUP BY c.id, c.name, c.email  
ORDER BY total\_spent DESC  
LIMIT 20;  
\`\`\`

\*\*Análisis con EXPLAIN:\*\*  
\`\`\`sql  
EXPLAIN ANALYZE \[query arriba\]

\-- Output muestra:  
Seq Scan on customers c  (cost=0.00..50000.00 rows=5000 width=100)  
  Filter: (tenant\_id \= '...' AND status \= 'active')  
  Rows Removed by Filter: 95000  
\-- 🚨 Seq Scan en tabla grande (100K rows)  
\-- 🚨 Filtra 95K rows (ineficiente)  
\`\`\`

\*\*Optimización 1: Agregar index\*\*  
\`\`\`sql  
\-- Crear index compuesto  
CREATE INDEX idx\_customers\_tenant\_status   
    ON customers(tenant\_id, status);

\-- Re-ejecutar EXPLAIN ANALYZE  
\-- Ahora muestra:  
Index Scan using idx\_customers\_tenant\_status on customers c  
  Index Cond: (tenant\_id \= '...' AND status \= 'active')  
\-- ✅ Usa index  
\-- ✅ No filtra rows (todas pasan el check)

\-- Tiempo: 3500ms → 150ms (23x más rápido)  
\`\`\`

\*\*Optimización 2: Agregar index en FK\*\*  
\`\`\`sql  
\-- orders.customer\_id también necesita index para JOIN  
CREATE INDEX idx\_orders\_customer\_id ON orders(customer\_id);

\-- Tiempo: 150ms → 45ms (3x más rápido)  
\`\`\`

\*\*Optimización 3: Partial index para activos\*\*  
\`\`\`sql  
\-- Solo nos interesan customers activos  
DROP INDEX idx\_customers\_tenant\_status;

CREATE INDEX idx\_customers\_tenant\_active   
    ON customers(tenant\_id, total\_purchases\_amount DESC)  
    WHERE status \= 'active';  
\-- Partial index: más pequeño, más rápido

\-- Tiempo: 45ms → 12ms (4x más rápido)  
\`\`\`

\*\*Query final optimizada (12ms):\*\*  
\`\`\`sql  
SELECT   
    c.name,  
    c.email,  
    COUNT(o.id) as order\_count,  
    SUM(o.total) as total\_spent  
FROM customers c  
LEFT JOIN orders o ON c.id \= o.customer\_id  
WHERE c.tenant\_id \= '123e4567-e89b-12d3-a456-426614174000'  
AND c.status \= 'active'  
GROUP BY c.id, c.name, c.email  
ORDER BY total\_spent DESC  
LIMIT 20;

\-- Mejora: 3500ms → 12ms (291x más rápido) ✅  
\`\`\`

\#\#\# Ejemplo 2: Optimizar Query de Predicciones

\*\*Query original (vertical de Activación):\*\*  
\`\`\`python  
\# Python \- Vertical de Activación  
def get\_customers\_to\_activate(tenant\_id, days\_inactive=90):  
    """Obtener customers inactivos para reactivar"""  
      
    query \= """  
        SELECT   
            c.id,  
            c.name,  
            c.email,  
            c.phone,  
            c.last\_purchase\_date,  
            (  
                SELECT json\_agg(p.\*)  
                FROM products p  
                WHERE p.id IN (  
                    SELECT oi.product\_id  
                    FROM order\_items oi  
                    JOIN orders o ON oi.order\_id \= o.id  
                    WHERE o.customer\_id \= c.id  
                    ORDER BY o.created\_at DESC  
                    LIMIT 5  
                )  
            ) as favorite\_products  
        FROM customers c  
        WHERE c.tenant\_id \= %s  
        AND c.status \= 'active'  
        AND c.last\_purchase\_date \< NOW() \- INTERVAL '%s days'  
        ORDER BY c.last\_purchase\_date DESC  
        LIMIT 50  
    """  
      
    return db.execute(query, (tenant\_id, days\_inactive)).fetchall()

\# Problema: Subquery por CADA customer (N+1)  
\# Con 50 customers → 50+ queries internas  
\# Tiempo: \~2 segundos  
\`\`\`

\*\*Optimización: Evitar subquery correlacionada\*\*  
\`\`\`python  
def get\_customers\_to\_activate(tenant\_id, days\_inactive=90):  
    """Versión optimizada"""  
      
    \# Query 1: Obtener customers inactivos  
    customers\_query \= """  
        SELECT   
            id,  
            name,  
            email,  
            phone,  
            last\_purchase\_date  
        FROM customers  
        WHERE tenant\_id \= %s  
        AND status \= 'active'  
        AND last\_purchase\_date \< NOW() \- INTERVAL '%s days'  
        ORDER BY last\_purchase\_date DESC  
        LIMIT 50  
    """  
      
    customers \= db.execute(customers\_query, (tenant\_id, days\_inactive)).fetchall()  
      
    if not customers:  
        return \[\]  
      
    customer\_ids \= \[c\['id'\] for c in customers\]  
      
    \# Query 2: Obtener últimos productos de TODOS los customers de una vez  
    products\_query \= """  
        WITH customer\_orders AS (  
            SELECT DISTINCT ON (o.customer\_id, oi.product\_id)  
                o.customer\_id,  
                oi.product\_id,  
                o.created\_at  
            FROM orders o  
            JOIN order\_items oi ON o.order\_id \= oi.id  
            WHERE o.customer\_id \= ANY(%s)  
            ORDER BY o.customer\_id, oi.product\_id, o.created\_at DESC  
        ),  
        ranked\_products AS (  
            SELECT   
                co.customer\_id,  
                co.product\_id,  
                ROW\_NUMBER() OVER (PARTITION BY co.customer\_id ORDER BY co.created\_at DESC) as rn  
            FROM customer\_orders co  
        )  
        SELECT   
            rp.customer\_id,  
            json\_agg(p.\*) as products  
        FROM ranked\_products rp  
        JOIN products p ON rp.product\_id \= p.id  
        WHERE rp.rn \<= 5  
        GROUP BY rp.customer\_id  
    """  
      
    products\_result \= db.execute(products\_query, (customer\_ids,)).fetchall()  
      
    \# Mapear productos a customers  
    products\_by\_customer \= {r\['customer\_id'\]: r\['products'\] for r in products\_result}  
      
    \# Asignar a customers  
    for customer in customers:  
        customer\['favorite\_products'\] \= products\_by\_customer.get(customer\['id'\], \[\])  
      
    return customers

\# Mejora: 2000ms → 85ms (23x más rápido) ✅  
\# 2 queries en vez de 50+  
\`\`\`

\#\#\# Ejemplo 3: Optimizar Búsqueda Full-Text

\*\*Caso: Búsqueda de productos por nombre\*\*  
\`\`\`sql  
\-- ❌ Query lenta con LIKE  
SELECT \* FROM products  
WHERE tenant\_id \= 'uuid-iey'  
AND name ILIKE '%magsafe%';

\-- EXPLAIN muestra Seq Scan (no usa index)  
\-- Tiempo: 850ms con 10K productos  
\`\`\`

\*\*Optimización: Full-text search\*\*  
\`\`\`sql  
\-- 1\. Agregar columna tsvector  
ALTER TABLE products   
ADD COLUMN name\_searchable tsvector  
GENERATED ALWAYS AS (to\_tsvector('spanish', name)) STORED;

\-- 2\. Crear GIN index  
CREATE INDEX idx\_products\_name\_search   
    ON products USING GIN(name\_searchable);

\-- 3\. Query optimizada  
SELECT \* FROM products  
WHERE tenant\_id \= 'uuid-iey'  
AND name\_searchable @@ to\_tsquery('spanish', 'magsafe');

\-- Tiempo: 850ms → 8ms (106x más rápido) ✅  
\`\`\`

\*\*Bonus: Ranking de resultados\*\*  
\`\`\`sql  
SELECT   
    \*,  
    ts\_rank(name\_searchable, to\_tsquery('spanish', 'magsafe')) as relevance  
FROM products  
WHERE tenant\_id \= 'uuid-iey'  
AND name\_searchable @@ to\_tsquery('spanish', 'magsafe')  
ORDER BY relevance DESC;  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: Over-indexing  
\`\`\`sql  
\-- ❌ MAL \- Demasiados indexes  
CREATE INDEX idx1 ON customers(tenant\_id);  
CREATE INDEX idx2 ON customers(status);  
CREATE INDEX idx3 ON customers(created\_at);  
CREATE INDEX idx4 ON customers(tenant\_id, status);  
CREATE INDEX idx5 ON customers(tenant\_id, created\_at);  
CREATE INDEX idx6 ON customers(tenant\_id, status, created\_at);  
\-- 6 indexes → writes lentos, espacio desperdiciado

\-- ✅ BIEN \- Indexes estratégicos  
CREATE INDEX idx\_customers\_tenant ON customers(tenant\_id);  
CREATE INDEX idx\_customers\_tenant\_status ON customers(tenant\_id, status);  
\-- 2 indexes cubren la mayoría de queries  
\`\`\`

\#\#\# Error 2: Index en columna de baja cardinalidad  
\`\`\`sql  
\-- ❌ MAL  
CREATE INDEX idx\_customers\_is\_active ON customers(is\_active);  
\-- Boolean: solo 2 valores (true/false)  
\-- Index no ayuda mucho

\-- ✅ MEJOR \- Partial index  
CREATE INDEX idx\_active\_customers   
    ON customers(tenant\_id)   
    WHERE is\_active \= true;  
\-- Solo indexa los activos  
\`\`\`

\#\#\# Error 3: SELECT \* innecesario  
\`\`\`sql  
\-- ❌ MAL  
SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey';  
\-- Trae TODAS las columnas (incluso las no usadas)

\-- ✅ BIEN  
SELECT id, name, email FROM customers WHERE tenant\_id \= 'uuid-iey';  
\-- Solo las columnas necesarias  
\-- Menos data transferida, más rápido  
\`\`\`

\#\#\# Error 4: No usar LIMIT  
\`\`\`sql  
\-- ❌ MAL  
SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey' ORDER BY created\_at DESC;  
\-- Trae TODOS los customers (potencialmente miles)

\-- ✅ BIEN  
SELECT \* FROM customers WHERE tenant\_id \= 'uuid-iey' ORDER BY created\_at DESC LIMIT 100;  
\-- Solo los primeros 100  
\-- Frontend puede hacer paginación  
\`\`\`

\#\#\# Error 5: Estadísticas desactualizadas  
\`\`\`sql  
\-- Síntoma: EXPLAIN muestra estimación muy diferente de realidad  
\-- rows=5 (actual rows=5000)

\-- ❌ Problema: PostgreSQL no conoce distribución de data

\-- ✅ Solución: Actualizar estadísticas  
ANALYZE customers;

\-- O para toda la DB  
ANALYZE;

\-- Configurar auto-analyze (en postgresql.conf)  
autovacuum \= on  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Antes de declarar query "optimizada"  
\- \[ \] EXPLAIN ANALYZE ejecutado  
\- \[ \] Usa indexes (no Seq Scan en tablas grandes)  
\- \[ \] Execution Time \<100ms para queries comunes  
\- \[ \] Estimaciones de rows cercanas a realidad  
\- \[ \] No hay N+1 queries  
\- \[ \] SELECT solo columnas necesarias  
\- \[ \] Tiene LIMIT si retorna múltiples rows

\#\#\# Indexes creados  
\- \[ \] tenant\_id (TODAS las tablas multi-tenant)  
\- \[ \] Foreign keys  
\- \[ \] Columnas en WHERE frecuentes  
\- \[ \] Composite indexes para queries con múltiples filtros  
\- \[ \] Partial indexes para subsets frecuentes

\#\#\# Performance medida  
\- \[ \] Queries de dashboard \<100ms  
\- \[ \] Queries de listados \<200ms  
\- \[ \] Queries complejas (JOINs) \<500ms  
\- \[ \] Full-text search \<50ms  
\- \[ \] Materialized views refresheadas periódicamente

\---

\#\# 📊 Métricas de Éxito

Queries optimizadas si:  
\- ✅ 95%+ queries \<100ms  
\- ✅ 0 Seq Scans en tablas \>1000 rows  
\- ✅ Index usage \>80%  
\- ✅ Dashboard carga en \<1 segundo  
\- ✅ 0 N+1 queries en código

\---

\#\# 💡 Para Pato (Comandos Útiles)

\#\#\# Ver queries lentas  
\`\`\`sql  
\-- Habilitar logging de queries lentas (postgresql.conf)  
\-- log\_min\_duration\_statement \= 100  \# Log queries \>100ms

\-- Ver queries lentas en logs  
tail \-f /var/log/postgresql/postgresql-\*.log | grep "duration:"  
\`\`\`

\#\#\# Ver index usage  
\`\`\`sql  
\-- Ver qué indexes se usan y cuáles no  
SELECT   
    schemaname,  
    tablename,  
    indexname,  
    idx\_scan as index\_scans,  
    idx\_tup\_read as tuples\_read,  
    idx\_tup\_fetch as tuples\_fetched  
FROM pg\_stat\_user\_indexes  
WHERE schemaname \= 'public'  
ORDER BY idx\_scan ASC;

\-- idx\_scan \= 0 → Index nunca usado (considerar drop)  
\`\`\`

\#\#\# Ver tamaño de indexes  
\`\`\`sql  
SELECT  
    tablename,  
    indexname,  
    pg\_size\_pretty(pg\_relation\_size(indexrelid)) as index\_size  
FROM pg\_stat\_user\_indexes  
WHERE schemaname \= 'public'  
ORDER BY pg\_relation\_size(indexrelid) DESC;  
\`\`\`

\#\#\# Encontrar queries duplicadas  
\`\`\`sql  
\-- Ver queries más ejecutadas  
SELECT   
    query,  
    calls,  
    total\_time,  
    mean\_time,  
    min\_time,  
    max\_time  
FROM pg\_stat\_statements  
ORDER BY calls DESC  
LIMIT 20;

\-- Requiere extension pg\_stat\_statements  
CREATE EXTENSION IF NOT EXISTS pg\_stat\_statements;  
\`\`\`

\---  
