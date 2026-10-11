-- Run once in the Supabase SQL editor. Then set the owner UUID as documented.
create table public.studio_owner (
  singleton boolean primary key default true check(singleton),
  owner_id uuid not null unique references auth.users(id)
);
alter table public.studio_owner enable row level security;
revoke all on public.studio_owner from anon, authenticated;

-- Keep the policy helper outside the public PostgREST API schema.
create schema if not exists studio_private;
revoke all on schema studio_private from public, anon;
grant usage on schema studio_private to authenticated;
create function studio_private.is_studio_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.studio_owner where owner_id=(select auth.uid())); $$;
revoke all on function studio_private.is_studio_owner() from public, anon, authenticated;
grant execute on function studio_private.is_studio_owner() to authenticated;

create table public.studio_workspaces (
  owner_id uuid primary key references auth.users(id),
  revision bigint not null default 0 check(revision >= 0),
  state jsonb not null check(jsonb_typeof(state)='object')
);
alter table public.studio_workspaces enable row level security;
revoke all on public.studio_workspaces from anon;
grant select,insert,update,delete on public.studio_workspaces to authenticated;
create policy studio_owner_workspace on public.studio_workspaces for all to authenticated
using (owner_id=(select auth.uid()) and (select studio_private.is_studio_owner()))
with check (owner_id=(select auth.uid()) and (select studio_private.is_studio_owner()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('studio','studio',false,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml','text/html','text/css','text/javascript','application/javascript','font/woff2','text/plain','application/xml'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy studio_owner_files on storage.objects for all to authenticated
using (bucket_id='studio' and (storage.foldername(name))[1]=(select auth.uid())::text and (select studio_private.is_studio_owner()))
with check (bucket_id='studio' and (storage.foldername(name))[1]=(select auth.uid())::text and (select studio_private.is_studio_owner()));
