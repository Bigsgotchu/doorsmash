// Mutual verification viewing: each side of a booking may watch the
// OTHER side's verification video clip. Clips stay private to the booking —
// this endpoint mints a short-lived signed URL after a party check.
//
// GET /api/bookings/[id]/clip?subject=renter|companion

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBookingAsParty } from "@/lib/plusone/booking-server";

function storagePath(urlOrPath: string): string {
  // Stored values are bucket-relative paths, but tolerate full URLs.
  const marker = "/verification-clips/";
  const idx = urlOrPath.indexOf(marker);
  return idx >= 0 ? urlOrPath.slice(idx + marker.length) : urlOrPath;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  if (subject !== "renter" && subject !== "companion") {
    return NextResponse.json(
      { error: "subject must be 'renter' or 'companion'." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const party = await getBookingAsParty(supabase, id, user.id);
  if (!party) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // You may only view the OTHER side's clip.
  const allowed =
    (subject === "renter" && party.isCompanion) ||
    (subject === "companion" && party.isRenter);
  if (!allowed) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!["requested", "confirmed", "completed"].includes(party.booking.status as string)) {
    return NextResponse.json({ error: "Clip is not available for this booking." }, { status: 403 });
  }

  const subjectUserId =
    subject === "renter" ? (party.booking.renter_id as string) : party.companionUserId;

   // Use service-role admin client to read the OTHER side's submission.
  // RLS on verification_submissions only allows users to see their own;
  // the booking-party check above already authorized this access.
  const admin = await createAdminClient();
  const { data: submission } = await admin
    .from("verification_submissions")
    .select("video_clip_url")
    .eq("user_id", subjectUserId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!submission?.video_clip_url) {
    return NextResponse.json({ error: "No verification clip on file." }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("verification-clips")
    .createSignedUrl(storagePath(submission.video_clip_url as string), 300);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not load the clip." }, { status: 500 });
  }
  return NextResponse.json({ data: { url: signed.signedUrl, expiresIn: 300 } });
}
