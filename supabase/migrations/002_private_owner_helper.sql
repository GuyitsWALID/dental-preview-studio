-- Upgrade projects that applied the original public policy helper.
-- Fresh installations of 001 already use this private schema.
create schema if not exists studio_private;
revoke all on schema studio_private from public, anon;
grant usage on schema studio_private to authenticated;

create or replace function studio_private.is_studio_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.studio_owner where owner_id=(select auth.uid())); $$;
revoke all on function studio_private.is_studio_owner() from public, anon, authenticated;
grant execute on function studio_private.is_studio_owner() to authenticated;

alter policy studio_owner_workspace on public.studio_workspaces
using (owner_id=(select auth.uid()) and (select studio_private.is_studio_owner()))
with check (owner_id=(select auth.uid()) and (select studio_private.is_studio_owner()));
alter policy studio_owner_files on storage.objects
using (bucket_id='studio' and (storage.foldername(name))[1]=(select auth.uid())::text and (select studio_private.is_studio_owner()))
with check (bucket_id='studio' and (storage.foldername(name))[1]=(select auth.uid())::text and (select studio_private.is_studio_owner()));

-- No policy now depends on the old, exposed helper. Never cascade this drop.
drop function if exists public.is_studio_owner();
