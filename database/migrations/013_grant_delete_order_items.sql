-- Migracion 013: GRANT DELETE en order_items para pymepilot_app
-- Fecha: 2026-02-22
-- Por que: la estrategia de sync para order_items es DELETE+INSERT
-- (no tiene UNIQUE constraint para upsert). Sin este permiso, el sync falla.
-- SOLO order_items: ninguna otra tabla necesita DELETE en Fase 1.
-- Principio de minimo privilegio: solo dar el permiso exacto que se necesita.

GRANT DELETE ON order_items TO pymepilot_app;
