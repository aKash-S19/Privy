-- Utility function to force PostgREST schema cache refresh.
create or replace function public.reload_schema_cache()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

grant execute on function public.reload_schema_cache() to anon, authenticated, service_role;
