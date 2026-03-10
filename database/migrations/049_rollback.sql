-- Rollback 049: Eliminar RPCs de demanda por cliente

DROP FUNCTION IF EXISTS public.get_client_demand_projection(int);
DROP FUNCTION IF EXISTS public.get_client_demand_detail(uuid);

NOTIFY pgrst, 'reload schema';
