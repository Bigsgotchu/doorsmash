-- ============================================================
-- PlusOne Phase 2: bookings, booking chat, strikes, renter verification
--
-- bookings             - renter booking requests + lifecycle
-- booking_messages     - chat on confirmed bookings
-- companion_profiles.strikes - no-show / companion-cancel strikes
-- verification_submissions.kind - 'companion' | 'renter'
-- notifications        - booking event types + booking-party insert policy
--
-- Every statement is idempotent (safe to apply and re-apply).
-- ============================================================

-- ------------------------------------------------------------
-- 1. bookings table
-- ------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid references public.profiles(id) on delete cascade not null,
  companion_id uuid references public.companion_profiles(id) on delete cascade not null,
  status text not null default 'requested'
    check (status in (
      'requested', 'confirmed', 'denied',
      'cancelled_by_renter', 'cancelled_by_companion', 'completed'
    )),
  -- event details
  event_title text not null check (char_length(event_title) between 1 and 120),
  event_description text check (char_length(event_description) <= 2000),
  event_type text,
  event_date date not null,
  start_time time not null,
  end_time time,
  event_location text not null,
  -- money snapshot (cents; 80/20 split baked in at request time)
  rate_type text not null check (rate_type in ('hourly', 'evening')),
  rate_cents integer not null check (rate_cents > 0),
  hours numeric check (hours is null or hours > 0),
  total_cents integer not null check (total_cents > 0),
  companion_payout_cents integer not null check (companion_payout_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  -- free-text exchange
  renter_message text check (char_length(renter_message) <= 1000),
  companion_response text check (char_length(companion_response) <= 1000),
  -- cancellation outcome (per official cancellation policy)
  cancelled_by text check (cancelled_by in ('renter', 'companion')),
  refund_cents integer check (refund_cents is null or refund_cents >= 0),
  -- lifecycle timestamps
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz
);

create index if not exists bookings_renter_idx
  on public.bookings (renter_id, status, event_date);
create index if not exists bookings_companion_idx
  on public.bookings (companion_id, status, event_date);

-- ------------------------------------------------------------
-- 2. booking_messages table (chat opens on confirm)
-- ------------------------------------------------------------
create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists booking_messages_booking_idx
  on public.booking_messages (booking_id, created_at);

-- ------------------------------------------------------------
-- 3. strikes + verification kind columns
-- ------------------------------------------------------------
alter table public.companion_profiles
  add column if not exists strikes integer not null default 0;

alter table public.verification_submissions
  add column if not exists kind text not null default 'companion'
    check (kind in ('companion', 'renter'));

-- ------------------------------------------------------------
-- 4. notification types for booking events
-- ------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'match', 'message', 'date_proposal',
    'booking_requested', 'booking_confirmed', 'booking_denied',
    'booking_cancelled', 'booking_message'
  ));

-- ------------------------------------------------------------
-- 5. realtime publication membership for the new tables
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['bookings', 'booking_messages']
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
-- 6. Row Level Security
-- ------------------------------------------------------------
alter table public.bookings enable row level security;
alter table public.booking_messages enable row level security;

-- bookings ----------------------------------------------------
drop policy if exists "Booking parties can view their bookings"
  on public.bookings;
create policy "Booking parties can view their bookings"
  on public.bookings for select
  using (
    renter_id = auth.uid()
    or exists (
      select 1 from public.companion_profiles cp
      where cp.id = bookings.companion_id
        and cp.user_id = auth.uid()
    )
  );

-- Requesting a booking requires full verification (approved submission).
drop policy if exists "Verified renters can request approved companions"
  on public.bookings;
create policy "Verified renters can request approved companions"
  on public.bookings for insert
  to authenticated
  with check (
    renter_id = auth.uid()
    and event_date >= current_date
    and exists (
      select 1 from public.companion_profiles cp
      where cp.id = companion_id
        and cp.verification_status = 'approved'
    )
    and exists (
      select 1 from public.verification_submissions vs
      where vs.user_id = auth.uid()
        and vs.status = 'approved'
    )
  );

-- Companion confirms or denies an open request.
drop policy if exists "Companions can confirm or deny requests"
  on public.bookings;
create policy "Companions can confirm or deny requests"
  on public.bookings for update
  to authenticated
  using (
    status = 'requested'
    and exists (
      select 1 from public.companion_profiles cp
      where cp.id = bookings.companion_id
        and cp.user_id = auth.uid()
    )
  )
  with check (status in ('confirmed', 'denied'));

-- Renter cancels an active booking.
drop policy if exists "Renters can cancel own bookings"
  on public.bookings;
create policy "Renters can cancel own bookings"
  on public.bookings for update
  to authenticated
  using (
    renter_id = auth.uid()
    and status in ('requested', 'confirmed')
  )
  with check (status = 'cancelled_by_renter');

-- Companion cancels an active booking (strike recorded separately).
drop policy if exists "Companions can cancel own bookings"
  on public.bookings;
create policy "Companions can cancel own bookings"
  on public.bookings for update
  to authenticated
  using (
    status in ('requested', 'confirmed')
    and exists (
      select 1 from public.companion_profiles cp
      where cp.id = bookings.companion_id
        and cp.user_id = auth.uid()
    )
  )
  with check (status = 'cancelled_by_companion');

-- Completing a booking is done by the renter after the event.
drop policy if exists "Renters can complete own bookings"
  on public.bookings;
create policy "Renters can complete own bookings"
  on public.bookings for update
  to authenticated
  using (
    renter_id = auth.uid()
    and status = 'confirmed'
  )
  with check (status = 'completed');

drop policy if exists "Admins manage bookings"
  on public.bookings;
create policy "Admins manage bookings"
  on public.bookings for all
  using (public.is_admin(auth.uid()));

-- booking_messages ---------------------------------------------
drop policy if exists "Booking parties can read messages"
  on public.booking_messages;
create policy "Booking parties can read messages"
  on public.booking_messages for select
  using (
    exists (
      select 1 from public.bookings b
      join public.companion_profiles cp on cp.id = b.companion_id
      where b.id = booking_messages.booking_id
        and (b.renter_id = auth.uid() or cp.user_id = auth.uid())
    )
  );

-- Chat opens when the booking is confirmed.
drop policy if exists "Booking parties can message on confirmed bookings"
  on public.booking_messages;
create policy "Booking parties can message on confirmed bookings"
  on public.booking_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      join public.companion_profiles cp on cp.id = b.companion_id
      where b.id = booking_messages.booking_id
        and b.status = 'confirmed'
        and (b.renter_id = auth.uid() or cp.user_id = auth.uid())
    )
  );

drop policy if exists "Admins manage booking messages"
  on public.booking_messages;
create policy "Admins manage booking messages"
  on public.booking_messages for all
  using (public.is_admin(auth.uid()));

-- notifications: booking parties can notify each other ------------
drop policy if exists "Users can notify their booking parties"
  on public.notifications;
create policy "Users can notify their booking parties"
  on public.notifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      join public.companion_profiles cp on cp.id = b.companion_id
      where (b.renter_id = auth.uid() and cp.user_id = recipient_id)
         or (cp.user_id = auth.uid() and b.renter_id = recipient_id)
    )
  );

-- ------------------------------------------------------------
-- 7. record_companion_strike() — SECURITY DEFINER
--
-- Called when a companion cancels (or no-shows). Only the companion
-- themselves or an admin may record it. Auto-suspends at 3 strikes.
-- ------------------------------------------------------------
create or replace function public.record_companion_strike(p_companion_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_strikes integer;
begin
  if not exists (
    select 1 from public.companion_profiles cp
    where cp.id = p_companion_id
      and (cp.user_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception 'not authorized to record strike';
  end if;

  update public.companion_profiles
  set strikes = strikes + 1
  where id = p_companion_id
  returning strikes into new_strikes;

  if new_strikes is null then
    raise exception 'companion profile not found';
  end if;

  if new_strikes >= 3 then
    update public.companion_profiles
    set verification_status = 'suspended'
    where id = p_companion_id;
  end if;

  return new_strikes;
end;
$$;
