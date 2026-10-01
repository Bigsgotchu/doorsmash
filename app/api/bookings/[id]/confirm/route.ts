// Companion confirms a booking request. Marks overlapping availability
// slots as booked and notifies the renter.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { defaultEndTime, timesOverlap } from "@/lib/plusone/booking";
import {
  getBookingAsParty,
  notifyBookingParty,
} from "@/lib/plusone/booking-server";

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
      status: "confirmed",
      responded_at: new Date().toISOString(),
      companion_response: parsed.data.message ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: error?.message ?? "Could not confirm booking." },
      { status: 500 },
    );
  }

  // Mark the companion's overlapping open slots as booked.
  const endTime = (booking.end_time as string) ?? defaultEndTime(booking.start_time as string);
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("id, start_time, end_time")
    .eq("companion_id", booking.companion_id as string)
    .eq("date", booking.event_date as string)
    .eq("status", "open");
  const overlapping = (slots ?? [])
    .filter((s) =>
      timesOverlap(
        booking.start_time as string,
        endTime,
        s.start_time ?? "00:00",
        s.end_time ?? "23:59",
      ),
    )
    .map((s) => s.id);
  if (overlapping.length > 0) {
    await supabase
      .from("availability_slots")
      .update({ status: "booked" })
      .in("id", overlapping);
  }

  await notifyBookingParty(supabase, {
    recipientId: booking.renter_id as string,
    type: "booking_confirmed",
    title: "Booking confirmed!",
    body: `Your plus-one confirmed "${booking.event_title as string}". Chat is now open.`,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({ data: booking });
}
