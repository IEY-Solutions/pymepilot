-- Migration 025: Fix idx_customers_new para matchear query real de V1
-- Fecha: 2026-02-26
-- Descripcion: El indice original usaba WHERE status = 'new' pero ningun
--   codigo pone status 'new' — todos los clientes entran como 'active'.
--   La query de V1 Activacion filtra WHERE status = 'active' AND
--   total_purchases_count = 1. Este indice matchea esa query.
-- Origen: Auditoria Fase 5, hallazgo H-03 (@db-architect)

-- Eliminar el indice que nunca se usa (0 filas con status='new')
DROP INDEX IF EXISTS idx_customers_new;

-- Crear indice que matchea la query real de get_activation_candidates()
CREATE INDEX IF NOT EXISTS idx_customers_activation
    ON customers(tenant_id, first_purchase_date DESC)
    WHERE status = 'active' AND total_purchases_count = 1;
