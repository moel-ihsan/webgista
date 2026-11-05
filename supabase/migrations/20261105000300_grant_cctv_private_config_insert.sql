-- PostgREST requires the relation-level INSERT grant for this direct insert.
-- Row-level security continues to scope writes to cameras the actor manages.
grant insert on table public.cctv_private_config to authenticated;
