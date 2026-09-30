-- ============================================================
-- DoorSmash Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, created_at, updated_at)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', now(), now());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Table: profiles
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  display_name text,
  age integer check (age > 0),
  bio text,
  neighborhood text,
  location text,
  distance_preference integer default 25,
  gender text,
  gender_preference text,
  primary_photo_url text,
  is_verified boolean default false,
  is_profile_complete boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- ============================================================
-- Table: swipes (one-way likes/passes)
-- ============================================================
create table public.swipes (
  id bigint generated always as identity primary key,
  swiper_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  direction text check (direction in ('like', 'pass')) not null,
  created_at timestamp with time zone default now() not null,
  unique (swiper_id, target_id)
);

create index on public.swipes (swiper_id);
create index on public.swipes (target_id);

-- ============================================================
-- Table: matches (mutual likes)
-- ============================================================
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references public.profiles(id) on delete cascade not null,
  user_b uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique (user_a, user_b)
);

create index on public.matches (user_a);
create index on public.matches (user_b);

-- ============================================================
-- Table: conversations (1:1 chat tied to a match)
-- ============================================================
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  user_a uuid references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  unique (user_a, user_b)
);

create index on public.conversations (user_a);
create index on public.conversations (user_b);

-- ============================================================
-- Table: messages
-- ============================================================
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text check (length(trim(content)) > 0) not null,
  created_at timestamp with time zone default now() not null
);

create index on public.messages (conversation_id, created_at);

-- ============================================================
-- Table: date_ideas (catalog of suggestions)
-- ============================================================
create table public.date_ideas (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,
  description text,
  image_url text,
  created_at timestamp with time zone default now() not null
);

-- ============================================================
-- Table: date_proposals
-- ============================================================
create table public.date_proposals (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  proposer_id uuid references public.profiles(id) on delete cascade,
  date_idea_id bigint references public.date_ideas(id),
  custom_title text,
  location_name text,
  proposed_at timestamp with time zone,
  proposed_time timestamp with time zone not null,
  note text,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending' not null,
  created_at timestamp with time zone default now() not null
);

create index on public.date_proposals (match_id);
create index on public.date_proposals (conversation_id);

-- ============================================================
-- Table: notifications
-- ============================================================
create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('match', 'message', 'date_proposal')) not null,
  title text not null,
  body text,
  data jsonb,
  read boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create index on public.notifications (recipient_id, read, created_at desc);

-- ============================================================
-- Table: reports
-- ============================================================
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reported_id uuid references public.profiles(id) on delete cascade not null,
  reason text check (reason in ('inappropriate', 'spam', 'harassment', 'other')) not null,
  details text,
  status text check (status in ('pending', 'reviewed', 'resolved')) default 'pending' not null,
  created_at timestamp with time zone default now() not null
);

create index on public.reports (status, created_at);

-- ============================================================
-- Table: blocked_users
-- ============================================================
create table public.blocked_users (
  id bigint generated always as identity primary key,
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique (blocker_id, blocked_id)
);

create index on public.blocked_users (blocker_id);

-- ============================================================
-- Table: admin_users
-- ============================================================
create table public.admin_users (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  created_at timestamp with time zone default now() not null
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update their own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- swipes
alter table public.swipes enable row level security;

create policy "Users can create their own swipes"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

create policy "Users can read their own swipes"
  on public.swipes for select
  using (auth.uid() = swiper_id or auth.uid() = target_id);

-- matches
alter table public.matches enable row level security;

create policy "Match participants can view matches"
  on public.matches for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- conversations
alter table public.conversations enable row level security;

create policy "Conversation participants can access conversations"
  on public.conversations for all
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- messages
alter table public.messages enable row level security;

create policy "Conversation participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "Conversation participants can send messages"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- date_ideas
alter table public.date_ideas enable row level security;

create policy "Date ideas are viewable by authenticated users"
  on public.date_ideas for select
  using (auth.uid() is not null);

-- date_proposals
alter table public.date_proposals enable row level security;

create policy "Match participants can view date proposals"
  on public.date_proposals for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = date_proposals.match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

create policy "Match participants can create date proposals"
  on public.date_proposals for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = date_proposals.match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

-- notifications
alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

-- reports
alter table public.reports enable row level security;

create policy "Users can create reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Admins can manage reports"
  on public.reports for all
  using (
    exists (select 1 from public.admin_users where id = auth.uid())
  );

-- blocked_users
alter table public.blocked_users enable row level security;

create policy "Users can manage their own blocks"
  on public.blocked_users for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create policy "Users can read blocks that affect them"
  on public.blocked_users for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

-- admin_users
alter table public.admin_users enable row level security;

create policy "Admins only"
  on public.admin_users for all
  using (exists (select 1 from public.admin_users where id = auth.uid()));

-- ============================================================
-- Helper function: check if user is admin
-- ============================================================
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where id = user_id);
$$;

-- ============================================================
-- Storage bucket policies
-- (Configure via UI or SQL below)
-- ============================================================

-- profile-photos bucket: users can upload to their own folder, all authenticated can read
insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true);
insert into storage.buckets (id, name, public) values ('date-photos', 'date-photos', true);

create policy "Authenticated users can upload profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated users can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

-- ============================================================
-- Update trigger for profiles
-- ============================================================
create or replace function public.handle_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_update
  before update on public.profiles
  for each row execute function public.handle_profile_update();

-- ============================================================
-- Seed data: date ideas
-- ============================================================
insert into public.date_ideas (title, category, description, image_url) values
  ('Pasta & a little gossip', 'DINNER', 'Sorella · 7:00 pm', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=700&q=80'),
  ('Golden hour, on foot', 'WALK', 'Silver Lake Reservoir · 6:15 pm', 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=700&q=80'),
  ('One drink, no big plan', 'DRINKS', 'Bar Flores · 8:00 pm', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=700&q=80');
