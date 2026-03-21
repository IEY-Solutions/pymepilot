-- Migración 057: Arquitectura multi-módulo de PymePilot
--
-- QUE HACE ESTA MIGRACION:
-- Agrega dos campos a la tabla tenants para soportar la arquitectura
-- de plataforma multi-módulo:
--
--   segment: el mercado al que pertenece este tenant
--            ('mayorista', 'minorista_a', 'minorista_b', 'servicios')
--
--   active_modules: lista de módulos habilitados para este tenant
--            ('seguimiento', 'cotizaciones', 'portal', etc.)
--
-- POR QUE:
-- PymePilot escala de un solo producto (seguimiento) a una plataforma
-- con múltiples módulos. Cada tenant activa los módulos de su plan.
-- El frontend lee active_modules para construir el sidebar dinámicamente.
--
-- ESTADO ACTUAL:
-- IEY y todos los tenants mayoristas activos arrancan con
-- active_modules = ['seguimiento'] y segment = 'mayorista'.
-- Cuando se active un nuevo módulo para un tenant, se hace:
--   UPDATE tenants SET active_modules = array_append(active_modules, 'cotizaciones')
--   WHERE slug = 'iey';
--
-- ROLLBACK: 057_rollback.sql

BEGIN;

-- 1. Agregar columna segment
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'mayorista';

-- 2. Agregar columna active_modules
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS active_modules TEXT[] NOT NULL DEFAULT ARRAY['seguimiento'];

-- 3. Setear valores correctos para tenants ya existentes
UPDATE public.tenants
SET
    segment = 'mayorista',
    active_modules = ARRAY['seguimiento']
WHERE active_modules = ARRAY['seguimiento']; -- idempotente

-- 4. Constraint: segment debe ser un valor conocido
ALTER TABLE public.tenants
ADD CONSTRAINT IF NOT EXISTS tenants_segment_check
CHECK (segment IN ('mayorista', 'minorista_a', 'minorista_b', 'minorista_c', 'servicios'));

-- 5. Constraint: active_modules no puede estar vacío
ALTER TABLE public.tenants
ADD CONSTRAINT IF NOT EXISTS tenants_active_modules_not_empty
CHECK (cardinality(active_modules) > 0);

-- 6. Notificar a PostgREST para que recargue el schema
NOTIFY pgrst, 'reload schema';

COMMIT;
