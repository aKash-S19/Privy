-- Force PostgREST to reload schema cache after introducing new tables.
select pg_notify('pgrst', 'reload schema');
