// Booking detail for a party to the booking. Includes display info for
// both sides and whether each side's verification clip may be viewed.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBookingAsParty } from "@/lib/plusone/booking-server";

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

  const { data: renter } = await supabase
    .from("profiles")
    .select("display_name, primary_photo_url")
    .eq("id", party.booking.renter_id)
    .maybeSingle();

  const { data: companion } = await supabase
    .from("profiles")
    .select("display_name, primary_photo_url")
    .eq("id", party.companionUserId)
    .maybeSingle();

  const clipsVisible = ["requested", "confirmed", "completed"].includes(
    party.booking.status as string,
  );

  return NextResponse.json({
    data: {
      ...party.booking,
      renter: renter ?? null,
      companion: companion ?? null,
      viewerId: user.id,
      viewerIsRenter: party.isRenter,
      viewerIsCompanion: party.isCompanion,
      // Each side may view the OTHER side's verification clip once booked.
      canViewRenterClip: clipsVisible && party.isCompanion,
      canViewCompanionClip: clipsVisible && party.isRenter,
    },
  });
}
