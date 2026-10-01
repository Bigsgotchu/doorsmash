-- Completion datetime guard (Phase 2 bug fix, Oct 1 2026).
--
-- Bug: "Renters can complete own bookings" only checked status='confirmed',
-- so a renter could mark a booking completed before its event started.
--
-- Fix: the confirmed -> completed transition now also requires the event's
-- start (event_date + start_time) to have passed in America/Denver wall
-- time. Event times are entered and understood as Denver local (SLC launch),
-- so the guard compares Denver wall time to Denver wall time — never the
-- database's timezone setting.
--
-- The API route (app/api/bookings/[id]/complete) enforces the same rule
-- via eventHasStarted() and returns a clean 400; this policy is the
-- database-level backstop.

drop policy if exists "Renters can complete own bookings"
  on public.bookings;
create policy "Renters can complete own bookings"
  on public.bookings for update
  to authenticated
  using (
    renter_id = auth.uid()
    and status = 'confirmed'
    and (event_date + start_time)::timestamp <= (now() at time zone 'America/Denver')
  )
  with check (status = 'completed');
