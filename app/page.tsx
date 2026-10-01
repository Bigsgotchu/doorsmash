// PlusOne public homepage — the front door of the marketplace.
// Public: no login required. This replaced the old dating-app home.

import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/plusone/rates";
import "./become-companion/become-companion.css";
import "./bookings/bookings.css";
import "./homepage.css";

export const dynamic = "force-dynamic";

interface FeaturedCompanion {
  id: string;
  bio: string | null;
  hourly_rate: number | null;
  evening_rate: number | null;
  rating_avg: number;
  total_bookings: number;
  display_name: string;
  primary_photo_url: string | null;
}

async function getFeaturedCompanions(): Promise<FeaturedCompanion[]> {
  const supabase = await createClient();
  // RLS: the public can only SELECT approved companion profiles.
  const { data: companions } = await supabase
    .from("companion_profiles")
    .select(
      "id, user_id, bio, hourly_rate, evening_rate, rating_avg, total_bookings",
    )
    .eq("verification_status", "approved")
    .order("rating_avg", { ascending: false })
    .limit(4);
  if (!companions || companions.length === 0) return [];

  const userIds = [...new Set(companions.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, primary_photo_url")
    .in("id", userIds);
  const byId: Record<
    string,
    { display_name: string | null; primary_photo_url: string | null }
  > = {};
  for (const p of profiles ?? []) byId[p.id] = p;

  return companions.map((c) => ({
    id: c.id,
    bio: c.bio,
    hourly_rate: c.hourly_rate,
    evening_rate: c.evening_rate,
    rating_avg: c.rating_avg ?? 0,
    total_bookings: c.total_bookings ?? 0,
    display_name: byId[c.user_id]?.display_name ?? "PlusOne Companion",
    primary_photo_url: byId[c.user_id]?.primary_photo_url ?? null,
  }));
}

function rateLabel(c: FeaturedCompanion): string {
  if (c.evening_rate) return `${formatUSD(c.evening_rate)} / evening`;
  if (c.hourly_rate) return `${formatUSD(c.hourly_rate)} / hour`;
  return "Rate on request";
}

const STEPS = [
  {
    n: "1",
    title: "Browse verified companions",
    text: "Every companion is ID-verified with a video clip before they ever appear here. Browse free, pick your favorite.",
  },
  {
    n: "2",
    title: "Request your plus-one",
    text: "Send a booking request with your event details. One clear price, shown up front — no surprises.",
  },
  {
    n: "3",
    title: "They confirm, you enjoy",
    text: "Your companion confirms, and you walk in together. Strictly platonic, always.",
  },
];

const TRUST = [
  { title: "Verified humans", text: "Government ID + a live video clip. No catfish, ever." },
  { title: "Strictly platonic", text: "Event companionship only. That's the whole product." },
  { title: "One clear price", text: "The companion sets the rate. You see exactly what you pay." },
];

export default async function HomePage() {
  const user = await getUser().catch(() => null);
  const featured = await getFeaturedCompanions();

  return (
    <div className="po-home">
      <header className="po-home-nav">
        <Link href="/" className="po-home-brand" aria-label="PlusOne home">
          <span className="po-home-plus">+</span> plusone
        </Link>
        <nav className="po-home-links">
          <Link href="/companions">Browse companions</Link>
          <Link href="#how-it-works">How it works</Link>
          {user ? (
            <Link href="/bookings" className="po-home-cta">
              My bookings
            </Link>
          ) : (
            <Link href="/login" className="po-home-cta">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className="po-home-hero">
          <p className="po-eyebrow">Now launching · Salt Lake City</p>
          <h1>
            Never go
            <br />
            alone again.
          </h1>
          <p className="po-home-lede">
            Book a verified plus-one for weddings, galas, parties, and
            everything in between. Real humans, verified identity, strictly
            platonic.
          </p>
          <div className="po-btn-row">
            <Link href="/companions" className="po-btn">
              Find your plus-one
            </Link>
            <Link
              href="/become-companion/apply"
              className="po-btn po-btn-secondary"
            >
              Become a companion
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="po-home-section">
          <h2>How it works</h2>
          <div className="po-home-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="po-home-step">
                <span className="po-home-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="po-home-section">
          <div className="po-home-section-head">
            <h2>Featured companions</h2>
            <Link href="/companions" className="po-home-see-all">
              See all →
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="po-home-empty">
              <p>
                Our first companions are being verified right now. Check back
                soon — or be first in line.
              </p>
              <Link
                href="/become-companion/apply"
                className="po-btn po-btn-secondary"
              >
                Become a companion
              </Link>
            </div>
          ) : (
            <div className="po-grid">
              {featured.map((c) => (
                <Link
                  key={c.id}
                  href={`/companions/${c.id}`}
                  className="po-card po-home-card-link"
                >
                  {c.primary_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.primary_photo_url}
                      alt={c.display_name}
                      className="po-card-photo"
                    />
                  ) : (
                    <div className="po-card-photo-fallback" aria-hidden="true">
                      <span>+</span>
                    </div>
                  )}
                  <div className="po-card-body">
                    <h3 className="po-card-name">{c.display_name}</h3>
                    <p className="po-card-rates">{rateLabel(c)}</p>
                    {c.bio && (
                      <p className="po-home-card-bio">{c.bio.slice(0, 90)}{c.bio.length > 90 ? "…" : ""}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="po-home-trust">
          {TRUST.map((t) => (
            <div key={t.title} className="po-home-trust-item">
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </div>
          ))}
        </section>

        <section className="po-cta-band">
          <h2>Your next event called. It wants company.</h2>
          <p>Browse verified companions in Salt Lake City — free to look.</p>
          <Link href="/companions" className="po-btn">
            Find your plus-one
          </Link>
        </section>
      </main>

      <footer className="po-home-footer">
        <p>
          <span className="po-home-plus">+</span> plusone · Never go alone
          again.
        </p>
        <p className="po-fine">Salt Lake City, Utah · © 2026</p>
      </footer>
    </div>
  );
}
