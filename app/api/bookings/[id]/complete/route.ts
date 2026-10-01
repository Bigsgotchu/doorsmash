// Renter marks a confirmed booking completed after the event.
// (Reviews build on this in a later phase.)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBookingAsParty } from "@/lib/plusone/booking-server";
import { eventHasStarted } from "@/lib/plusone/booking";

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
  if (!party || !party.isRenter) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (party.booking.status !== "confirmed") {
    return NextResponse.json(
      { error: `This booking is ${party.booking.status}.` },
      { status: 400 },
    );
  }
  // A booking can only be completed once its event has started
  // (America/Denver wall time). RLS enforces the same rule; this
  // returns a clean 400 instead of an RLS violation.
  if (
    !eventHasStarted(party.booking.event_date, party.booking.start_time)
  ) {
    return NextResponse.json(
      { error: "This event hasn't started yet." },
      { status: 400 },
    );
  }

  // RLS ("Renters can complete own bookings") enforces the transition.
  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: error?.message ?? "Could not complete booking." },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: booking });
}
