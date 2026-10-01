import Link from "next/link";
import "../become-companion.css";

export const metadata = {
  title: "Application Received | PlusOne",
};

export default function PendingPage() {
  return (
    <main className="po-shell">
      <div className="po-cta-band">
        <p className="po-eyebrow">✨ Application received</p>
        <h1 className="po-title" style={{ fontSize: "clamp(2rem, 7vw, 3rem)" }}>
          You&apos;re in the queue!
        </h1>
        <p className="po-sub">
          A real human is reviewing your ID, selfie, and video clip. Most
          applications are approved within a day — we&apos;ll notify you the
          moment you&apos;re live.
        </p>
        <div className="po-steps" style={{ textAlign: "left" }}>
          <div className="po-step">
            <h3>What happens next</h3>
            <p>
              We check that your clip matches your photos and that everything
              looks right. If we need anything else, we&apos;ll reach out.
              Once approved, your profile goes live and renters can find you by
              date.
            </p>
          </div>
        </div>
        <p style={{ marginTop: "2rem" }}>
          <Link href="/" className="po-cta">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
