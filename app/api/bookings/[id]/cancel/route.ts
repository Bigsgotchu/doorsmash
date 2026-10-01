// Either party cancels an active booking. Applies the official
// cancellation policy: renter 72h+ = full refund; renter inside 72h =
// 50% refund with the forfeited half split 80/20; companion cancel =
// full refund + a strike on the companion.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingStartsAt, computeCancellation } from "@/lib/plusone/booking";
import {
  getBookingAsParty,
  notifyBookingParty,
} from "@/lib/plusone/booking-server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const party = await getBookingAsParty(supabase, id, user.id);
  if (!party || (!party.isRenter && !party.isCompanion)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!["requested", "confirmed"].includes(party.booking.status as string)) {
    return NextResponse.json(
      { error: `This booking is already ${party.booking.status}.` },
      { status: 400 },
    );
  }

  const cancelledBy = party.isRenter ? "renter" : "companion";
  const outcome = computeCancellation({
    totalCents: party.booking.total_cents,
    cancelledBy,
    eventStartsAt: bookingStartsAt(
      party.booking.event_date as string,
      party.booking.start_time as string,
    ),
  });

  // RLS enforces which status each party may set.
  const { data: booking, error } = await supabase
    .from("bookings")
    .update({
      status: cancelledBy === "renter" ? "cancelled_by_renter" : "cancelled_by_companion",
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
      refund_cents: outcome.refundCents,
      companion_payout_cents: outcome.companionPayoutCents,
      platform_fee_cents: outcome.platformFeeCents,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: error?.message ?? "Could not cancel booking." },
      { status: 500 },
    );
  }

  let strikes: number | null = null;
  if (cancelledBy === "companion") {
    const { data, error: strikeError } = await supabase.rpc(
      "record_companion_strike",
      { p_companion_id: party.booking.companion_id },
    );
    if (!strikeError) strikes = data as number;
  }

  await notifyBookingParty(supabase, {
    recipientId: party.isRenter ? party.companionUserId : (booking.renter_id as string),
    type: "booking_cancelled",
    title: "Booking cancelled",
    body: outcome.summary,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({ data: { ...booking, strikes, cancellation: outcome } });
}
