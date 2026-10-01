-- ============================================================
-- DoorSmash fix: admin RLS recursion, realtime publication, buckets
--
-- The base schema was applied via a one-off script; these three items
-- need correcting on the live database. Every statement below is
-- idempotent, so this migration is safe to apply (and re-apply).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fix infinite recursion on admin_users
--
-- The base schema's "Admins only" policy queried public.admin_users
-- from inside its own USING clause, so any query touching admin_users
-- (e.g. filing a report, whose admin policy reads admin_users)
-- recursed forever: "infinite recursion detected in policy for
-- relation admin_users".
--
-- Fix: route all admin checks through the SECURITY DEFINER helper
-- public.is_admin(), which bypasses RLS and cannot recurse.
-- ------------------------------------------------------------
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where id = user_id);
$$;

drop policy if exists "Admins can manage reports" on public.reports;
create policy "Admins can manage reports"
  on public.reports for all
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins only" on public.admin_users;
create policy "Admins only"
  on public.admin_users for all
  using (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 2. Ensure realtime publication membership
--
-- The app subscribes to postgres_changes on these tables. If a table
-- is missing from the supabase_realtime publication, subscriptions
-- connect fine but silently receive nothing.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'conversations', 'matches', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ------------------------------------------------------------
-- 3. Ensure storage buckets exist
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', true),
  ('date-photos', 'date-photos', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. Ensure storage object policies exist
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can upload profile photos" on storage.objects;
create policy "Authenticated users can upload profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Authenticated users can view profile photos" on storage.objects;
create policy "Authenticated users can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');
