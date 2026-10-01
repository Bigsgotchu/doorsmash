import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingRequestForm from "./_components/booking-request-form";
import "../../become-companion/become-companion.css";
import "../../bookings/bookings.css";

export const metadata = {
  title: "Request a booking | PlusOne",
};

interface PageProps {
  searchParams: Promise<{ companion?: string }>;
}

export default async function NewBookingPage({ searchParams }: PageProps) {
  const { companion: companionId } = await searchParams;
  if (!companionId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/book/new%3Fcompanion%3D" + companionId);

  // RLS: only approved companions are visible here.
  const { data: companion } = await supabase
    .from("companion_profiles")
    .select("id, user_id, bio, hourly_rate, evening_rate")
    .eq("id", companionId)
    .eq("verification_status", "approved")
    .maybeSingle();
  if (!companion) notFound();

  if (companion.user_id === user.id) {
    redirect(`/companions/${companionId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, primary_photo_url")
    .eq("id", companion.user_id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("date, start_time, end_time")
    .eq("companion_id", companion.id)
    .eq("status", "open")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(60);

  // Is the renter already verified? (The API enforces it; this is a hint.)
  const { data: verification } = await supabase
    .from("verification_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  return (
    <main className="po-shell">
      <div className="po-wrap" style={{ maxWidth: 720 }}>
        <p className="po-eyebrow">PlusOne · Booking request</p>
        <h1 className="po-title">
          Book {profile?.display_name ?? "your plus-one"}
        </h1>
        <p className="po-sub">
          Send a request with your event details. The companion confirms or
          declines — usually within a day.
        </p>
        <BookingRequestForm
          companion={{
            id: companion.id,
            displayName: profile?.display_name ?? "PlusOne Companion",
            photoUrl: profile?.primary_photo_url ?? null,
            hourlyRate: companion.hourly_rate != null ? Number(companion.hourly_rate) : null,
            eveningRate: companion.evening_rate != null ? Number(companion.evening_rate) : null,
          }}
          openSlots={(slots ?? []).map((s) => ({
            date: s.date as string,
            startTime: (s.start_time as string | null) ?? "00:00",
            endTime: (s.end_time as string | null) ?? "23:59",
          }))}
          isVerified={!!verification}
        />
      </div>
    </main>
  );
}
