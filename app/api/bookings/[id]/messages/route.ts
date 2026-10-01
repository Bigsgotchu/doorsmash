// Booking chat. Opens when the booking is confirmed (enforced by RLS).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBookingAsParty, notifyBookingParty } from "@/lib/plusone/booking-server";

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
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
  if (!party) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("booking_messages")
    .select("id, sender_id, content, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

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
  if (!party) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  // RLS ("Booking parties can message on confirmed bookings") enforces
  // sender = self, party membership, and confirmed status.
  const { data: message, error } = await supabase
    .from("booking_messages")
    .insert({
      booking_id: id,
      sender_id: user.id,
      content: parsed.data.content.trim(),
    })
    .select("id, sender_id, content, created_at")
    .single();

  if (error || !message) {
    const chatOpen = party.booking.status === "confirmed";
    return NextResponse.json(
      { error: chatOpen ? (error?.message ?? "Could not send.") : "Chat opens when the booking is confirmed." },
      { status: chatOpen ? 500 : 403 },
    );
  }

  await notifyBookingParty(supabase, {
    recipientId: party.isRenter ? party.companionUserId : (party.booking.renter_id as string),
    type: "booking_message",
    title: "New booking message",
    body: parsed.data.content.trim().slice(0, 120),
    data: { booking_id: id },
  });

  return NextResponse.json({ data: message }, { status: 201 });
}
