// Companion declines a booking request.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBookingAsParty, notifyBookingParty } from "@/lib/plusone/booking-server";

const schema = z.object({
  message: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const party = await getBookingAsParty(supabase, id, user.id);
  if (!party || !party.isCompanion) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (party.booking.status !== "requested") {
    return NextResponse.json(
      { error: `This booking is already ${party.booking.status}.` },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  // RLS ("Companions can confirm or deny requests") enforces the transition.
  const { data: booking, error } = await supabase
    .from("bookings")
    .update({
      status: "denied",
      responded_at: new Date().toISOString(),
      companion_response: parsed.data.message ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: error?.message ?? "Could not decline booking." },
      { status: 500 },
    );
  }

  await notifyBookingParty(supabase, {
    recipientId: booking.renter_id as string,
    type: "booking_denied",
    title: "Booking declined",
    body: `The companion couldn't make "${booking.event_title as string}". Try another date or companion.`,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({ data: booking });
}
