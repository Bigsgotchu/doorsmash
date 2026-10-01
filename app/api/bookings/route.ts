// Booking requests: list mine (as renter and as companion) + create one.
// Creating a request requires full verification (approved submission);
// the companion must be an approved PlusOne companion with an open slot.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  bookingStartsAt,
  computeBookingTotals,
  defaultEndTime,
  timesOverlap,
  type RateType,
} from "@/lib/plusone/booking";
import {
  notifyBookingParty,
} from "@/lib/plusone/booking-server";

const createSchema = z.object({
  companion_id: z.string().uuid(),
  event_title: z.string().min(1).max(120),
  event_description: z.string().max(2000).optional(),
  event_type: z.string().max(40).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  event_location: z.string().min(1).max(200),
  rate_type: z.enum(["hourly", "evening"]),
  hours: z.number().positive().max(24).optional(),
  renter_message: z.string().max(1000).optional(),
});

async function displayNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Record<string, { display_name: string | null; primary_photo_url: string | null }>> {
  const out: Record<string, { display_name: string | null; primary_photo_url: string | null }> = {};
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, primary_photo_url")
    .in("id", [...new Set(userIds)]);
  for (const p of data ?? []) out[p.id] = p;
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS restricts both queries to bookings the caller is a party to.
  const { data: asRenter, error: renterError } = await supabase
    .from("bookings")
    .select("*")
    .eq("renter_id", user.id)
    .order("event_date", { ascending: true });

  const { data: myCompanion } = await supabase
    .from("companion_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let asCompanion: Record<string, unknown>[] = [];
  if (myCompanion) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("companion_id", myCompanion.id)
      .order("event_date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    asCompanion = data ?? [];
  }
  if (renterError) return NextResponse.json({ error: renterError.message }, { status: 500 });

  const all = [...(asRenter ?? []), ...asCompanion];
  const companionProfileIds = [...new Set(all.map((b) => (b as { companion_id: string }).companion_id))];
  const profileIdToUserId: Record<string, string> = {};
  if (companionProfileIds.length > 0) {
    const { data: cps } = await supabase
      .from("companion_profiles")
      .select("id, user_id")
      .in("id", companionProfileIds);
    for (const cp of cps ?? []) profileIdToUserId[cp.id] = cp.user_id;
  }
  const renterIds = all.map((b) => (b as { renter_id: string }).renter_id);
  const names = await displayNames(supabase, [
    ...Object.values(profileIdToUserId),
    ...renterIds,
  ]);

  const withNames = (rows: Record<string, unknown>[]) =>
    rows.map((b) => {
      const renter = names[b.renter_id as string] ?? null;
      const companionUserId = profileIdToUserId[b.companion_id as string];
      return {
        ...b,
        renter,
        companion: companionUserId ? (names[companionUserId] ?? null) : null,
      };
    });

  return NextResponse.json({
    asRenter: withNames((asRenter ?? []) as Record<string, unknown>[]),
    asCompanion: withNames(asCompanion),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const endTime = input.end_time ?? defaultEndTime(input.start_time);

  // 1. Companion must be approved and offer the requested rate type.
  const { data: companion } = await supabase
    .from("companion_profiles")
    .select("id, user_id, hourly_rate, evening_rate, verification_status")
    .eq("id", input.companion_id)
    .maybeSingle();
  if (!companion || companion.verification_status !== "approved") {
    return NextResponse.json({ error: "This companion is not available for booking." }, { status: 400 });
  }
  const rateDollars =
    input.rate_type === "hourly" ? companion.hourly_rate : companion.evening_rate;
  if (rateDollars == null || Number(rateDollars) <= 0) {
    return NextResponse.json(
      { error: `This companion does not offer a ${input.rate_type} rate.` },
      { status: 400 },
    );
  }

  // 2. Renter must be fully verified (approved ID + video submission).
  const { data: verification } = await supabase
    .from("verification_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (!verification) {
    return NextResponse.json(
      { error: "Verify your identity before requesting a booking.", code: "verification_required" },
      { status: 403 },
    );
  }

  // 3. The event must be in the future and the companion must have an
  //    open availability slot covering it.
  const startsAt = bookingStartsAt(input.event_date, input.start_time);
  if (startsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "The event must be in the future." }, { status: 400 });
  }
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("start_time, end_time")
    .eq("companion_id", input.companion_id)
    .eq("date", input.event_date)
    .eq("status", "open");
  const covered = (slots ?? []).some((s) =>
    timesOverlap(
      input.start_time,
      endTime,
      s.start_time ?? "00:00",
      s.end_time ?? "23:59",
    ),
  );
  if (!covered) {
    return NextResponse.json(
      { error: "The companion is not available at that time." },
      { status: 400 },
    );
  }

  // 4. No overlapping active booking for this companion.
  const { data: existing } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("companion_id", input.companion_id)
    .eq("event_date", input.event_date)
    .in("status", ["requested", "confirmed"]);
  const clash = (existing ?? []).some((b) =>
    timesOverlap(input.start_time, endTime, b.start_time, b.end_time ?? defaultEndTime(b.start_time)),
  );
  if (clash) {
    return NextResponse.json(
      { error: "The companion already has a booking at that time." },
      { status: 409 },
    );
  }

  // 5. Price it and insert. RLS enforces renter_id = auth.uid().
  let totals;
  try {
    totals = computeBookingTotals(input.rate_type as RateType, Number(rateDollars), input.hours);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid pricing." },
      { status: 400 },
    );
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      renter_id: user.id,
      companion_id: input.companion_id,
      event_title: input.event_title,
      event_description: input.event_description ?? null,
      event_type: input.event_type ?? null,
      event_date: input.event_date,
      start_time: input.start_time,
      end_time: endTime,
      event_location: input.event_location,
      rate_type: input.rate_type,
      rate_cents: totals.rateCents,
      hours: totals.hours,
      total_cents: totals.totalCents,
      companion_payout_cents: totals.companionPayoutCents,
      platform_fee_cents: totals.platformFeeCents,
      renter_message: input.renter_message ?? null,
    })
    .select()
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: error?.message ?? "Could not create booking." }, { status: 500 });
  }

  await notifyBookingParty(supabase, {
    recipientId: companion.user_id,
    type: "booking_requested",
    title: "New booking request",
    body: `${input.event_title} on ${input.event_date} — review and confirm or decline.`,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({ data: booking }, { status: 201 });
}
