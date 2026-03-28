-- 058: Grant SELECT on tenants to authenticated role
-- Fix: PostgREST returns 403 on tenants table because the authenticated role
-- (used by logged-in users via PostgREST) had no SELECT privilege.
-- Only pymepilot_app had SELECT, but PostgREST uses anon/authenticated roles.
-- RLS policy tenants_read_all (USING true) already allows reading all rows.

GRANT SELECT ON public.tenants TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
