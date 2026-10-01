// PlusOne landing page — the public front door.
// Verbatim port of the approved plusone-landing-page artifact design.

import Image from "next/image";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { SiteHeader } from "./_components/site-header";
import { Brand } from "./_components/brand";
import { WaitlistForm } from "./_components/waitlist-form";
import "./homepage.css";

function Sparkle({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`po-sparkle ${className}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2 C13.2 8.8 15.2 10.8 22 12 C15.2 13.2 13.2 15.2 12 22 C10.8 15.2 8.8 13.2 2 12 C8.8 10.8 10.8 8.8 12 2 Z" />
      </svg>
    </span>
  );
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21.5 7.5v9l-6-3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <circle cx="16.8" cy="9" r="2.5" />
      <path d="M16 14.7c2.3.2 3.9 1.6 4.4 4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 12V4.5A1 1 0 0 1 4.5 3.5H12L20.5 12a1.4 1.4 0 0 1 0 2L14 20.5a1.4 1.4 0 0 1-2 0L3.5 12Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5V9" />
      <rect x="3.5" y="7.5" width="17" height="11" rx="2.5" />
      <circle cx="17" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5 10 18 19.5 6.5" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

const OCCASIONS = [
  {
    title: "Weddings",
    text: "Dance-floor slot: filled. A companion who actually wants to be on it.",
    img: "/images/wedding.jpg",
    alt: "Newlyweds celebrating under falling confetti at a wedding",
  },
  {
    title: "Work parties",
    text: "Office politics without the awkwardness. Somebody charming to mingle with Steve from accounting.",
    img: "/images/work-party.jpg",
    alt: "Coworkers raising glasses in a toast at an office party",
  },
  {
    title: "Reunions",
    text: "Ten-year reunion? Walk in with somebody and own the room like the main character.",
    img: "/images/reunion.jpg",
    alt: "Friends laughing together around a dinner table at a reunion",
  },
  {
    title: "Galas",
    text: "Black-tie nights deserve a plus-one to match. Champagne optional, sparkling mandatory.",
    img: "/images/gala.jpg",
    alt: "Guests mingling at an elegant black-tie gala reception",
  },
];

export default async function LandingPage() {
  const user = await getUser().catch(() => null);

  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main className="po-lp">
        {/* ---------- hero ---------- */}
        <section className="po-lp-hero">
          <div className="po-wrap">
            <p className="po-launch-pill">
              <span className="po-dot" aria-hidden="true" />
              Launching in Salt Lake City
            </p>
            <h1 className="po-lp-h1">
              Never go <span className="po-pink">alone</span> again.
            </h1>
            <p className="po-lp-sub">
              The wedding is in three weeks and you&rsquo;re still &ldquo;plus
              none.&rdquo; Deep breath — we got you. PlusOne pairs you with a
              verified, strictly-platonic event companion who shows up, fits
              in, and makes the night better.
            </p>
            <div className="po-hero-ctas">
              <Link href="/companions" className="po-btn">
                Find your plus-one
              </Link>
              <Link href="/become-companion/apply" className="po-btn po-btn--ghost">
                Become a companion
              </Link>
            </div>
            <div className="po-trust-chips">
              <span className="po-chip">Video-verified, both sides</span>
              <span className="po-chip">Strictly platonic, always</span>
              <span className="po-chip">Reviewed by a real human</span>
            </div>
            <figure className="po-hero-photo" style={{ margin: "1rem 0 0" }}>
              <Image
                src="/images/hero.jpg"
                alt="Elegantly dressed adults dancing together on a wedding reception dance floor at night, under strings of glowing lights."
                fill
                sizes="(max-width: 1180px) 100vw, 1180px"
                priority
                style={{ objectFit: "cover" }}
              />
              <Sparkle style={{ top: "10%", left: "7%", width: 26, height: 26 }} />
              <Sparkle className="po-sparkle--b" style={{ top: "18%", right: "9%", width: 20, height: 20 }} />
              <Sparkle className="po-sparkle--d" style={{ bottom: "22%", left: "14%", width: 18, height: 18 }} />
              <Sparkle className="po-sparkle--c" style={{ bottom: "30%", right: "16%", width: 24, height: 24 }} />
            </figure>
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section id="how" className="po-lp-section">
          <div className="po-wrap">
            <div className="po-section-head">
              <h2>Your night, handled in three steps.</h2>
              <p>
                No apps to juggle, no loud awkward cousin to call in a panic.
                Just one request and you&rsquo;re covered.
              </p>
            </div>
            <div className="po-steps-grid">
              <article className="po-card po-step-card">
                <div className="po-step-num" aria-hidden="true">01</div>
                <h3>Browse verified companions</h3>
                <p>
                  Scroll profiles of companions who passed ID checks and our
                  video verification. Real faces, real availability, real
                  rates — no mystery, no catfish.
                </p>
              </article>
              <article className="po-card po-step-card">
                <div className="po-step-num po-step-num--b" aria-hidden="true">02</div>
                <h3>Send your request</h3>
                <p>
                  Tell them the plan: the occasion, date, time, venue, dress
                  code, even who&rsquo;s going. The more detail you give, the
                  better your night goes.
                </p>
              </article>
              <article className="po-card po-step-card">
                <div className="po-step-num po-step-num--c" aria-hidden="true">03</div>
                <h3>Confirm &amp; enjoy your night</h3>
                <p>
                  You both watch each other&rsquo;s verification clip first.
                  Once confirmed, walk in with somebody by your side like you
                  planned it all along.
                </p>
              </article>
            </div>
            <p className="po-lp-note">
              Sweet part: a companion can confirm or kindly decline a request.
              No ghosting, no guilt-trip — just a clean yes or no, both ways.
            </p>
          </div>
        </section>

        {/* ---------- trust & safety ---------- */}
        <section id="trust" className="po-lp-section po-trust-section">
          <div className="po-wrap po-lp-section-inner">
            <div className="po-section-head">
              <h2>Say hello before you meet.</h2>
              <p>
                Photos can be ten years old. A prompt-phrase video clip
                can&rsquo;t. Trust is the whole service, so we built the whole
                service around it.
              </p>
            </div>
            <div className="po-spot-grid">
              <div className="po-spot-text">
                <div className="po-mini-cards">
                  <div className="po-mini-card">
                    <span className="po-mini-icon"><IconVideo /></span>
                    <h4>Say the phrase</h4>
                    <p>
                      We hand each person a random prompt phrase to say on
                      camera. Pre-recorded fakes don&rsquo;t stand a chance.
                    </p>
                  </div>
                  <div className="po-mini-card">
                    <span className="po-mini-icon"><IconUsers /></span>
                    <h4>Mutual, always</h4>
                    <p>
                      You watch their clip before you request. They watch yours
                      before they confirm. Nobody feels singled out.
                    </p>
                  </div>
                  <div className="po-mini-card">
                    <span className="po-mini-icon"><IconLock /></span>
                    <h4>Private by design</h4>
                    <p>
                      Clips are visible only inside an active booking — never
                      public, never shared anywhere else.
                    </p>
                  </div>
                  <div className="po-mini-card">
                    <span className="po-mini-icon"><IconEye /></span>
                    <h4>Human-reviewed</h4>
                    <p>
                      A real person watches every clip and checks every ID
                      before anyone goes live on the service.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="po-clip-panel" aria-label="Inside a booking">
                <h3>Inside a booking</h3>
                <p className="po-sub">
                  Verification clips, visible to both of you — and only the two
                  of you.
                </p>
                <div className="po-clip-row">
                  <span className="po-clip-thumb"><IconPlay /></span>
                  <div>
                    <h4>Their clip</h4>
                    <p>Say: &ldquo;glitter tornado&rdquo; — and today&rsquo;s date</p>
                    <p>0:08 • Verified human</p>
                  </div>
                  <span className="po-chip po-chip--ok po-verified-badge">
                    Verified by PlusOne
                  </span>
                </div>
                <div className="po-clip-row">
                  <span className="po-clip-thumb"><IconPlay /></span>
                  <div>
                    <h4>Your clip</h4>
                    <p>Say: &ldquo;moonlight taco&rdquo; — and today&rsquo;s date</p>
                    <p>0:06 • Verified human</p>
                  </div>
                  <span className="po-chip po-chip--ok po-verified-badge">
                    Verified by PlusOne
                  </span>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ---------- companions ---------- */}
        <section id="companions" className="po-lp-section">
          <div className="po-wrap">
            <div className="po-duo">
              <div className="po-duo-photo">
                <Image
                  src="/images/portrait.jpg"
                  alt="A smiling PlusOne companion at an evening event"
                  fill
                  sizes="(max-width: 960px) 100vw, 45vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="po-duo-copy">
                <h2>
                  Your social life could be <span className="po-pink">paying you.</span>
                </h2>
                <p>
                  Love weddings? Actually enjoy small talk? Put those skills to
                  work — evenings you&rsquo;d spend at home anyway can fund
                  your life.
                </p>
                <div className="po-perk">
                  <span className="po-perk-icon"><IconCalendar /></span>
                  <div>
                    <h3>Earn on your free time</h3>
                    <p>
                      Set the days and timeframes you&rsquo;re available. You
                      only accept the requests you love — decline the rest with
                      zero penalty.
                    </p>
                  </div>
                </div>
                <div className="po-perk">
                  <span className="po-perk-icon"><IconTag /></span>
                  <div>
                    <h3>Set your own rate</h3>
                    <p>
                      Hourly or flat per evening — your profile, your price.
                      You&rsquo;re the one with the gift; charge like it.
                    </p>
                  </div>
                </div>
                <div className="po-perk">
                  <span className="po-perk-icon"><IconWallet /></span>
                  <div>
                    <h3>Keep 80% of every booking</h3>
                    <p>
                      No hidden cuts, no surprise fees. You did the showing up,
                      the charming, and the dancing — you keep the
                      lion&rsquo;s share.
                    </p>
                  </div>
                </div>
                <Link href="/become-companion/apply" className="po-btn">
                  Become a companion
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- occasions ---------- */}
        <section id="occasions" className="po-lp-section po-occasions-section">
          <div className="po-wrap">
            <div className="po-section-head">
              <h2>Made for the nights that matter.</h2>
              <p>
                Anywhere people bring somebody — that&rsquo;s our territory.
                Here&rsquo;s where PlusOne companions shine brightest.
              </p>
            </div>
            <div className="po-occasions-grid">
              {OCCASIONS.map((o) => (
                <article key={o.title} className="po-occasion-card">
                  <div className="po-occasion-photo">
                    <Image
                      src={o.img}
                      alt={o.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 25vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <h3>{o.title}</h3>
                  <p>{o.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- platonic band ---------- */}
        <section className="po-band" aria-label="Our one rule">
          <Sparkle style={{ top: "18%", left: "12%", width: 22, height: 22, color: "#fff" }} />
          <Sparkle className="po-sparkle--b" style={{ top: "30%", right: "14%", width: 18, height: 18, color: "#fff" }} />
          <Sparkle className="po-sparkle--c" style={{ bottom: "20%", left: "20%", width: 16, height: 16, color: "var(--pink)" }} />
          <h2>One rule. Zero wiggle room.</h2>
          <p>
            PlusOne is a strictly platonic service, full stop. Companions are
            company — a partner for the dance floor, the small talk, the group
            photos. Anyone testing that line is out. No second chances.
          </p>
        </section>

        {/* ---------- waitlist ---------- */}
        <section id="waitlist" className="po-lp-section">
          <div className="po-wrap">
            <div className="po-waitlist-panel">
              <div className="po-waitlist-copy">
                <h2>
                  Be first in line for the <span className="po-pink">Salt Lake City</span> launch.
                </h2>
                <p>
                  We&rsquo;re building our founding group of twenty verified
                  companions for the Salt Lake City launch. Join the waitlist
                  now and you&rsquo;re in before the rush.
                </p>
                <ul className="po-waitlist-perks">
                  <li>
                    <IconCheck />
                    <span>Founding members get first dibs when bookings open</span>
                  </li>
                  <li>
                    <IconCheck />
                    <span>Companions: apply early and skip the public application line</span>
                  </li>
                  <li>
                    <IconCheck />
                    <span>No spam, ever — just launch news and one or two party invitations</span>
                  </li>
                </ul>
              </div>
              <WaitlistForm />
            </div>
          </div>
        </section>

        {/* ---------- footer ---------- */}
        <footer className="po-lp-footer">
          <div className="po-wrap po-footer-inner">
            <Brand size={28} />
            <p className="po-fine" style={{ margin: 0 }}>
              Strictly platonic event companionship. Launching soon in Salt
              Lake City — event photos via Pexels.
            </p>
            <p className="po-fine" style={{ margin: 0 }}>
              © 2026 PlusOne. Never go alone again.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
