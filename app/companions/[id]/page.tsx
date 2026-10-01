import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/plusone/rates";
import type { AvailabilitySlot } from "@/lib/types";
import "../../become-companion/become-companion.css";
import "./companion.css";

export const metadata = {
  title: "Companion Profile | PlusOne",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatSlotDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

export default async function CompanionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS: the public can only SELECT approved companion profiles.
  const { data: companion } = await supabase
    .from("companion_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!companion) {
    notFound();
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
    .limit(14);

  const openSlots = (slots ?? []) as Pick<
    AvailabilitySlot,
    "date" | "start_time" | "end_time"
  >[];

  const name = profile?.display_name || "PlusOne Companion";

  return (
    <main className="po-shell">
      <div className="po-companion-wrap">
        <div className="po-companion-hero">
          <div className="po-avatar">
            {profile?.primary_photo_url ? (
              <img src={profile.primary_photo_url} alt={name} />
            ) : (
              <span aria-hidden="true">✨</span>
            )}
          </div>
          <div>
            <h1 className="po-companion-name">{name}</h1>
            <p className="po-verified-badge">✓ Verified human</p>
          </div>
        </div>

        {companion.bio && <p className="po-companion-bio">{companion.bio}</p>}

        {companion.interests?.length > 0 && (
          <div className="po-companion-interests">
            {companion.interests.map((interest: string) => (
              <span key={interest} className="po-chip-static">
                {interest}
              </span>
            ))}
          </div>
        )}

        <div className="po-companion-rates">
          {companion.hourly_rate != null && (
            <div className="po-rate">
              <span className="po-rate-value">
                {formatUSD(Number(companion.hourly_rate))}
              </span>
              <span className="po-rate-label">per hour</span>
            </div>
          )}
          {companion.evening_rate != null && (
            <div className="po-rate">
              <span className="po-rate-value">
                {formatUSD(Number(companion.evening_rate))}
              </span>
              <span className="po-rate-label">per evening</span>
            </div>
          )}
        </div>

        <section className="po-companion-section">
          <h2>Availability</h2>
          {openSlots.length === 0 ? (
            <p className="po-hint">No open dates right now — check back soon.</p>
          ) : (
            <ul className="po-slots">
              {openSlots.map((s, i) => (
                <li key={`${s.date}-${s.start_time}-${i}`}>
                  <strong>{formatSlotDate(s.date)}</strong>
                  <span>
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="po-companion-section">
          <h2>Reviews</h2>
          <p className="po-hint">
            Reviews appear here after the first bookings. Every event gets a
            two-way review — companions review renters too.
          </p>
        </section>

        <div className="po-companion-cta">
          <button type="button" className="po-cta" disabled>
            Request to book — opening soon
          </button>
          <p className="po-fine">
            Booking requests arrive with PlusOne Phase 2.
          </p>
        </div>
      </div>
    </main>
  );
}
