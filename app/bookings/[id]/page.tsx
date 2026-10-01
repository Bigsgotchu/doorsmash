"use client";

// PlusOne Phase 2: booking detail — event info, price breakdown, mutual
// verification clips, chat (opens on confirm), cancel / complete actions.

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BOOKING_STATUS_LABELS, timeUntil, type BookingStatus } from "@/lib/plusone/booking";
import { formatUSD } from "@/lib/plusone/rates";
import "../../become-companion/become-companion.css";
import "../bookings.css";

interface BookingDetail {
  id: string;
  status: BookingStatus;
  event_title: string;
  event_type: string | null;
  event_description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  event_location: string;
  rate_type: string;
  rate_cents: number;
  hours: number | null;
  total_cents: number;
  companion_payout_cents: number;
  platform_fee_cents: number;
  refund_cents: number | null;
  renter_message: string | null;
  companion_response: string | null;
  renter: { display_name: string | null; primary_photo_url: string | null } | null;
  companion: { display_name: string | null; primary_photo_url: string | null } | null;
  viewerId: string;
  viewerIsRenter: boolean;
  viewerIsCompanion: boolean;
  canViewRenterClip: boolean;
  canViewCompanionClip: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ClipViewer({ bookingId, subject, label }: { bookingId: string; subject: "renter" | "companion"; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/clip?subject=${subject}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the clip.");
      setUrl(json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the clip.");
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <video className="po-clip" controls src={url}>
        Your browser can&apos;t play this video.
      </video>
    );
  }
  return (
    <div>
      <button type="button" className="po-btn po-btn-secondary" onClick={load} disabled={loading}>
        {loading ? "Loading…" : label}
      </button>
      {error && <p className="po-error" style={{ marginTop: "0.6rem" }}>{error}</p>}
    </div>
  );
}

function Chat({ bookingId, viewerId }: { bookingId: string; viewerId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings/${bookingId}/messages`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.data ?? []);
    }
  }, [bookingId]);

  // Poll for new messages. State updates only after the fetch resolves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state set after await
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Could not send.");
      }
      setDraft("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="po-chat">
      <div className="po-chat-log">
        {messages.length === 0 && (
          <p className="po-hint" style={{ textAlign: "center" }}>
            Say hello — coordinate the details here.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`po-msg ${m.sender_id === viewerId ? "po-msg-mine" : "po-msg-them"}`}
          >
            {m.content}
            <span className="po-msg-time">
              {new Date(m.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="po-chat-form" onSubmit={send}>
        <input
          className="po-input"
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" className="po-btn" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load booking.");
      setBooking(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load booking.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state set after await
    void load();
  }, [load]);

  async function doAction(path: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setActing(true);
    try {
      const res = await fetch(`/api/bookings/${id}/${path}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed.");
      if (path === "cancel" && json.data?.cancellation?.summary) {
        alert(json.data.cancellation.summary);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <main className="po-shell">
        <div className="po-wrap"><p className="po-hint">Loading…</p></div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="po-shell">
        <div className="po-wrap">
          <p className="po-error">{error ?? "Booking not found."}</p>
          <Link href="/bookings" className="po-btn po-btn-secondary">Back to bookings</Link>
        </div>
      </main>
    );
  }

  const other = booking.viewerIsRenter ? booking.companion : booking.renter;
  const eventStart = new Date(`${booking.event_date}T${booking.start_time}:00`);
  const active = ["requested", "confirmed"].includes(booking.status);

  return (
    <main className="po-shell">
      <div className="po-wrap" style={{ maxWidth: 760 }}>
        <p>
          <Link href="/bookings" style={{ color: "#c2185b" }}>← My bookings</Link>
        </p>
        <div className="po-booking-top">
          <h1 className="po-title" style={{ margin: 0 }}>{booking.event_title}</h1>
          <span className={`po-status po-status-${booking.status}`}>
            {BOOKING_STATUS_LABELS[booking.status]}
          </span>
        </div>
        <p className="po-sub">
          With {other?.display_name ?? "your plus-one"} · in {timeUntil(eventStart)}
        </p>

        <dl className="po-detail-grid">
          <div className="po-detail-item">
            <dt>Date</dt>
            <dd>{formatDate(booking.event_date)}</dd>
          </div>
          <div className="po-detail-item">
            <dt>Time</dt>
            <dd>
              {booking.start_time.slice(0, 5)}
              {booking.end_time ? ` – ${booking.end_time.slice(0, 5)}` : ""}
            </dd>
          </div>
          <div className="po-detail-item">
            <dt>Location</dt>
            <dd>{booking.event_location}</dd>
          </div>
          <div className="po-detail-item">
            <dt>Event type</dt>
            <dd>{booking.event_type ?? "—"}</dd>
          </div>
        </dl>

        {booking.event_description && (
          <p className="po-hint">{booking.event_description}</p>
        )}

        <div className="po-price-box">
          <div className="po-price-row">
            <span>Rate</span>
            <span>
              {formatUSD(booking.rate_cents / 100)}
              {booking.rate_type === "hourly" && booking.hours
                ? ` × ${booking.hours}h`
                : " / evening"}
            </span>
          </div>
          <div className="po-price-row po-price-total">
            <span>Total</span>
            <span>{formatUSD(booking.total_cents / 100)}</span>
          </div>
          {booking.viewerIsCompanion && (
            <div className="po-price-row">
              <span>You receive (80%)</span>
              <span>{formatUSD(booking.companion_payout_cents / 100)}</span>
            </div>
          )}
          {booking.status === "confirmed" && booking.viewerIsRenter && (
            <p className="po-fine" style={{ margin: 0 }}>
              Payment happens before the event — PlusOne will send you a
              secure payment link.
            </p>
          )}
          {booking.refund_cents != null && (
            <div className="po-price-row">
              <span>Refunded</span>
              <span>{formatUSD(booking.refund_cents / 100)}</span>
            </div>
          )}
        </div>

        {booking.renter_message && (
          <section className="po-section-card">
            <h2>Message from the renter</h2>
            <p className="po-hint" style={{ margin: 0 }}>{booking.renter_message}</p>
          </section>
        )}

        {booking.companion_response && (
          <section className="po-section-card">
            <h2>Message from the companion</h2>
            <p className="po-hint" style={{ margin: 0 }}>{booking.companion_response}</p>
          </section>
        )}

        {(booking.canViewRenterClip || booking.canViewCompanionClip) && (
          <section className="po-section-card">
            <h2>Verification clips</h2>
            <p className="po-hint">
              Each side recorded a short video clip to prove they&apos;re a
              real human. Clips are private to this booking.
            </p>
            <div className="po-btn-row">
              {booking.canViewCompanionClip && (
                <ClipViewer
                  bookingId={booking.id}
                  subject="companion"
                  label={`Watch ${booking.companion?.display_name ?? "companion"}'s clip`}
                />
              )}
              {booking.canViewRenterClip && (
                <ClipViewer
                  bookingId={booking.id}
                  subject="renter"
                  label={`Watch ${booking.renter?.display_name ?? "renter"}'s clip`}
                />
              )}
            </div>
          </section>
        )}

        {booking.status === "confirmed" && (
          <section className="po-section-card">
            <h2>Chat</h2>
            <Chat bookingId={booking.id} viewerId={booking.viewerId} />
          </section>
        )}

        {active && (
          <section className="po-section-card">
            <h2>Manage booking</h2>
            <div className="po-btn-row">
              {booking.status === "confirmed" && booking.viewerIsRenter && (
                <button
                  type="button"
                  className="po-btn"
                  disabled={acting}
                  onClick={() =>
                    doAction("complete", "Mark this event as completed?")
                  }
                >
                  Mark as completed
                </button>
              )}
              <button
                type="button"
                className="po-btn po-btn-danger"
                disabled={acting}
                onClick={() =>
                  doAction(
                    "cancel",
                    "Cancel this booking? The cancellation policy applies: 72h+ = full refund, inside 72h = 50% refund.",
                  )
                }
              >
                Cancel booking
              </button>
            </div>
            <p className="po-fine">
              Cancelling 72+ hours ahead = full refund. Inside 72 hours the
              renter gets 50% back. If the companion cancels, the renter gets a
              full refund and the companion takes a strike.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
