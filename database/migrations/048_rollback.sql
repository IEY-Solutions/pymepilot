-- Rollback 048: Eliminar RPCs de proyeccion de demanda

DROP FUNCTION IF EXISTS public.get_demand_projection(int);
DROP FUNCTION IF EXISTS public.get_demand_projection_detail(uuid);

NOTIFY pgrst, 'reload schema';
