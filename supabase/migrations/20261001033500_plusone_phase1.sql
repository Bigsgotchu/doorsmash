-- ============================================================
-- PlusOne Phase 1: companion marketplace tables
--
-- companion_profiles   - bookable companion listings (one per user)
-- availability_slots   - per-date open/booked/blocked time windows
-- verification_submissions - ID + selfie + video clip review queue
--
-- Every statement is idempotent so the migration is safe to re-apply.
-- Admin checks route through public.is_admin() (SECURITY DEFINER)
-- to avoid the admin_users RLS recursion fixed in
-- 20261001010832_fix_admin_recursion_realtime_buckets.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.companion_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  bio text,
  interests text[] not null default '{}',
  hourly_rate numeric check (hourly_rate >= 0),
  evening_rate numeric check (evening_rate >= 0),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  verified_at timestamptz,
  rating_avg numeric not null default 0,
  total_bookings integer not null default 0,
  created_at timestamptz not null default now(),
  check (hourly_rate is not null or evening_rate is not null)
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid references public.companion_profiles(id) on delete cascade not null,
  date date not null,
  start_time time,
  end_time time,
  status text not null default 'open'
    check (status in ('open', 'booked', 'blocked')),
  created_at timestamptz not null default now()
);

create unique index if not exists availability_slots_companion_date_times_idx
  on public.availability_slots (companion_id, date, start_time, end_time);

create table if not exists public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  id_document_url text,
  selfie_url text,
  video_clip_url text,
  prompt_phrase text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One pending verification per user at a time (rejected users may re-apply).
create unique index if not exists verification_submissions_one_pending_per_user
  on public.verification_submissions (user_id)
  where status = 'pending';

-- ------------------------------------------------------------
-- 2. Row Level Security
-- ------------------------------------------------------------
alter table public.companion_profiles enable row level security;
alter table public.availability_slots enable row level security;
alter table public.verification_submissions enable row level security;

-- companion_profiles ------------------------------------------------
drop policy if exists "Public can view approved companion profiles"
  on public.companion_profiles;
create policy "Public can view approved companion profiles"
  on public.companion_profiles for select
  using (verification_status = 'approved');

drop policy if exists "Companions manage own profile"
  on public.companion_profiles;
create policy "Companions manage own profile"
  on public.companion_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- availability_slots ------------------------------------------------
drop policy if exists "Public can view open slots of approved companions"
  on public.availability_slots;
create policy "Public can view open slots of approved companions"
  on public.availability_slots for select
  using (
    status = 'open'
    and exists (
      select 1 from public.companion_profiles cp
      where cp.id = availability_slots.companion_id
        and cp.verification_status = 'approved'
    )
  );

drop policy if exists "Companions manage own availability"
  on public.availability_slots;
create policy "Companions manage own availability"
  on public.availability_slots for all
  using (
    exists (
      select 1 from public.companion_profiles cp
      where cp.id = availability_slots.companion_id
        and cp.user_id = auth.uid()
    )
  );

-- verification_submissions ------------------------------------------
drop policy if exists "Users view own verification submissions"
  on public.verification_submissions;
create policy "Users view own verification submissions"
  on public.verification_submissions for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own verification submissions"
  on public.verification_submissions;
create policy "Users create own verification submissions"
  on public.verification_submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins manage verification submissions"
  on public.verification_submissions;
create policy "Admins manage verification submissions"
  on public.verification_submissions for all
  using (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3. Private storage buckets for verification material
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('verification-docs', 'verification-docs', false),
  ('verification-clips', 'verification-clips', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. Storage object policies (owner path = <user_id>/...)
-- ------------------------------------------------------------
drop policy if exists "Owners can upload verification files"
  on storage.objects;
create policy "Owners can upload verification files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('verification-docs', 'verification-clips')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Owners and admins can view verification files"
  on storage.objects;
create policy "Owners and admins can view verification files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('verification-docs', 'verification-clips')
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Owners and admins can update verification files"
  on storage.objects;
create policy "Owners and admins can update verification files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('verification-docs', 'verification-clips')
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Owners and admins can delete verification files"
  on storage.objects;
create policy "Owners and admins can delete verification files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('verification-docs', 'verification-clips')
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );
