-- PlusOne Phase 1 bugfix: allow reporters to view their own reports.
--
-- The reports route (app/api/reports/route.ts) calls:
--   supabase.from("reports").insert({...}).select().single()
--
-- The INSERT succeeds (the row is written), but the subsequent
-- .select() reads the row back to return it. Without a SELECT
-- policy for reporters, RLS blocks the read, producing:
--   "new row violates row-level security policy for table 'reports'"
--
-- This ADDS a new SELECT policy only. No existing policies are
-- changed or removed.
-- ============================================================
-- ============================================================

create policy "Users can view their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);
