import Link from "next/link";
import "./become-companion.css";

export const metadata = {
  title: "Become a Companion | PlusOne",
  description:
    "Earn money on your free time as a verified PlusOne event companion. Keep 80% of every booking. Never go alone again.",
};

export default function BecomeCompanionPage() {
  return (
    <main className="po-shell">
      <header className="po-hero">
        <p className="po-eyebrow">✨ PlusOne Companions</p>
        <h1 className="po-title">
          Your free Saturdays
          <br />
          are worth money.
        </h1>
        <p className="po-sub">
          Become a verified event companion. Get booked for weddings, work
          parties, and reunions — and keep{" "}
          <strong>80% of every booking</strong>.
        </p>
        <Link href="/become-companion/apply" className="po-cta">
          Start your application
        </Link>
        <p className="po-fine">Free to apply · Salt Lake City launch</p>
      </header>

      <section className="po-section">
        <h2 className="po-h2">How it works</h2>
        <ol className="po-steps">
          <li className="po-step">
            <span className="po-step-num">1</span>
            <h3>Apply in minutes</h3>
            <p>
              Tell us about yourself, set your rates, and pick the days
              you&apos;re free.
            </p>
          </li>
          <li className="po-step">
            <span className="po-step-num">2</span>
            <h3>Get verified</h3>
            <p>
              Upload your ID and a selfie, then record a quick 15-second video
              clip. Real face, real person — that&apos;s the whole point.
            </p>
          </li>
          <li className="po-step">
            <span className="po-step-num">3</span>
            <h3>Get booked &amp; paid</h3>
            <p>
              Renters find you by date, send a request, you confirm — and you
              get paid after every event.
            </p>
          </li>
        </ol>
      </section>

      <section className="po-section po-money">
        <h2 className="po-h2">The money, plain and simple</h2>
        <div className="po-money-grid">
          <div className="po-money-card">
            <span className="po-money-label">You set</span>
            <span className="po-money-value">$150</span>
            <span className="po-money-note">per evening (your call)</span>
          </div>
          <div className="po-money-card po-money-you">
            <span className="po-money-label">You keep</span>
            <span className="po-money-value">$120</span>
            <span className="po-money-note">80% of every booking</span>
          </div>
        </div>
        <p className="po-money-fine">
          Platform minimums: $50/hr or $150/evening. Payouts land weekly after
          each event. No listing fees, no subscriptions — we only earn when you
          do.
        </p>
      </section>

      <section className="po-section">
        <h2 className="po-h2">Verified humans only</h2>
        <ul className="po-trust">
          <li>
            <span aria-hidden="true">🪪</span> Government ID check
          </li>
          <li>
            <span aria-hidden="true">🎥</span> 15-second video clip — say the
            prompt phrase so we know it&apos;s really you
          </li>
          <li>
            <span aria-hidden="true">⭐</span> Two-way reviews after every event
          </li>
          <li>
            <span aria-hidden="true">💗</span> Strictly platonic, always —
            it&apos;s in the terms, and we enforce it
          </li>
        </ul>
      </section>

      <section className="po-cta-band">
        <h2 className="po-h2">Ready when you are.</h2>
        <p className="po-sub">
          Applications are reviewed by a real human (hi, Karina 👋). Most are
          approved within a day.
        </p>
        <Link href="/become-companion/apply" className="po-cta">
          Start your application
        </Link>
      </section>
    </main>
  );
}
