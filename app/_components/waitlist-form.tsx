"use client";

import { useEffect, useState, type FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SEGMENTS = [
  { id: "companion", label: "Be a companion" },
  { id: "need", label: "Need a plus-one" },
  { id: "both", label: "Both, honestly" },
] as const;

type SegmentId = (typeof SEGMENTS)[number]["id"];

const WAITLIST_EMAIL = "gilleykarina91@gmail.com";

function mailtoHref(name: string, email: string, segment: SegmentId): string {
  const segLabel =
    SEGMENTS.find((s) => s.id === segment)?.label ?? "Both, honestly";
  const subject = `PlusOne Salt Lake City waitlist — ${name}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Interested as: ${segLabel}`,
    "City: Salt Lake City, UT",
  ].join("\n");
  return `mailto:${WAITLIST_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Waitlist signup. Client-side only, exactly like the approved landing page:
 * validates the email, then opens the visitor's mail app with a pre-drafted
 * signup email. No backend — the playbook hard gate keeps it this way until
 * a database-backed waitlist is approved.
 */
export function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<SegmentId>("both");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Lets in-page CTAs pre-select the matching segment (po:segment events).
  useEffect(() => {
    const onSegment = (e: Event) => {
      const id = (e as CustomEvent<SegmentId>).detail;
      if (SEGMENTS.some((s) => s.id === id)) setSegment(id);
    };
    window.addEventListener("po:segment", onSegment);
    return () => window.removeEventListener("po:segment", onSegment);
  }, []);

  const draftEmail = () => {
    window.location.href = mailtoHref(name.trim(), email.trim(), segment);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Add a valid email so we can actually reach you.");
      return;
    }
    setError(null);
    setDone(true);
    draftEmail();
  };

  if (done) {
    return (
      <div className="po-waitlist-success">
        <h3>Almost in — check your email app.</h3>
        <p>
          We drafted your waitlist email for you. Hit send and you&rsquo;re on
          the Salt Lake City launch list.
        </p>
        <p>
          Didn&rsquo;t see it? Your email app may block pop-ups &mdash;{" "}
          <button type="button" className="po-link" onClick={draftEmail}>
            click here to draft it again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="po-waitlist-form" onSubmit={onSubmit} noValidate>
      <div className="po-field">
        <label className="po-label" htmlFor="wl-name">
          Your name
        </label>
        <input
          id="wl-name"
          className="po-input"
          type="text"
          placeholder="Jessie Rivera"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="po-field">
        <label className="po-label" htmlFor="wl-email">
          Email address
        </label>
        <input
          id="wl-email"
          className="po-input"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <fieldset className="po-segments">
        <legend className="po-label">I&rsquo;m here to&hellip;</legend>
        <div className="po-segments-row">
          {SEGMENTS.map((s) => (
            <label key={s.id} className="po-radio-card po-segment-card">
              <input
                type="radio"
                name="waitlist-segment"
                value={s.id}
                checked={segment === s.id}
                onChange={() => setSegment(s.id)}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="po-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="po-btn">
        Join the waitlist
      </button>
      <p className="po-fine">
        Tap join and your email app finishes the signup — no accounts, no
        passwords, no nonsense.
      </p>
    </form>
  );
}
