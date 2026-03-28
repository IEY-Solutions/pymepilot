-- Rollback 058: Revoke SELECT on tenants from authenticated
REVOKE SELECT ON public.tenants FROM authenticated;
NOTIFY pgrst, 'reload schema';
