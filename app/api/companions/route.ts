// Public browse endpoint for verified PlusOne companions.
// Browsing is free: no login required.
//
// Query params:
//   date   YYYY-MM-DD — only companions with an open slot that day
//   q      free-text search over bio
//   limit  max rows (default 20, max 50)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
    50,
  );

  let companionIds: string[] | null = null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date (YYYY-MM-DD)." }, { status: 400 });
    }
    // RLS: the public can only see open slots of approved companions.
    const { data: slots, error: slotError } = await supabase
      .from("availability_slots")
      .select("companion_id")
      .eq("date", date)
      .eq("status", "open");
    if (slotError) {
      return NextResponse.json({ error: slotError.message }, { status: 500 });
    }
    companionIds = [...new Set((slots ?? []).map((s) => s.companion_id))];
    if (companionIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
  }

  // RLS: the public can only SELECT approved companion profiles.
  let query = supabase
    .from("companion_profiles")
    .select(
      "id, user_id, bio, interests, hourly_rate, evening_rate, rating_avg, total_bookings",
    )
    .eq("verification_status", "approved")
    .order("rating_avg", { ascending: false })
    .limit(limit);

  if (companionIds) query = query.in("id", companionIds);
  if (q) query = query.ilike("bio", `%${q}%`);

  const { data: companions, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach public profile info (display name + photo).
  const userIds = [...new Set((companions ?? []).map((c) => c.user_id))];
  const profilesById: Record<string, { display_name: string | null; primary_photo_url: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, primary_photo_url")
      .in("id", userIds);
    for (const p of profiles ?? []) profilesById[p.id] = p;
  }

  return NextResponse.json({
    data: (companions ?? []).map((c) => ({
      ...c,
      display_name: profilesById[c.user_id]?.display_name ?? "PlusOne Companion",
      primary_photo_url: profilesById[c.user_id]?.primary_photo_url ?? null,
    })),
  });
}
