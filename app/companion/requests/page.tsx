"use client";

// PlusOne Phase 2: the companion's incoming booking requests.
// Review the verified renter, watch their clip, confirm or decline.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/plusone/booking";
import { formatUSD } from "@/lib/plusone/rates";
import "../../become-companion/become-companion.css";
import "../../bookings/bookings.css";

interface Booking {
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
  hours: number | null;
  total_cents: number;
  companion_payout_cents: number;
  renter_message: string | null;
  created_at: string;
  renter: { display_name: string | null; primary_photo_url: string | null } | null;
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function RenterClip({ bookingId, renterName }: { bookingId: string; renterName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/clip?subject=renter`);
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
        {loading ? "Loading…" : `Watch ${renterName}'s verification clip`}
      </button>
      {error && <p className="po-error" style={{ marginTop: "0.6rem" }}>{error}</p>}
    </div>
  );
}

export default function CompanionRequestsPage() {
  const [requests, setRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [responseMsg, setResponseMsg] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load requests.");
      const all: Booking[] = json.asCompanion ?? [];
      setRequests(
        all
          .filter((b) => b.status === "requested")
          .sort((a, b) => a.event_date.localeCompare(b.event_date)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state set after await
    void load();
  }, [load]);

  async function respond(bookingId: string, action: "confirm" | "deny") {
    const verb = action === "confirm" ? "confirm" : "decline";
    if (!window.confirm(`${verb === "confirm" ? "Confirm" : "Decline"} this booking?`)) return;
    setActingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: responseMsg[bookingId]?.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Could not ${verb}.`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Could not ${verb}.`);
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="po-shell">
      <div className="po-wrap" style={{ maxWidth: 760 }}>
        <p className="po-eyebrow">PlusOne · Companion</p>
        <h1 className="po-title">Booking requests</h1>
        <p className="po-sub">
          Every renter is identity-verified. Review the event, watch their
          clip, then confirm or decline.
        </p>

        {error && <p className="po-error">{error}</p>}

        {loading ? (
          <p className="po-hint">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="po-empty">
            <h2>No pending requests</h2>
            <p>New requests will appear here as renters find you.</p>
            <Link href="/bookings" className="po-btn po-btn-secondary">
              View all my bookings
            </Link>
          </div>
        ) : (
          <div className="po-grid" style={{ gridTemplateColumns: "1fr" }}>
            {requests.map((b) => (
              <article key={b.id} className="po-booking-card">
                <div className="po-booking-top">
                  <h3 className="po-booking-title">{b.event_title}</h3>
                  <span className={`po-status po-status-${b.status}`}>
                    {BOOKING_STATUS_LABELS[b.status]}
                  </span>
                </div>
                <div className="po-booking-meta">
                  <span>
                    {formatDate(b.event_date)} · {b.start_time.slice(0, 5)}
                    {b.end_time ? ` – ${b.end_time.slice(0, 5)}` : ""}
                    {b.event_type ? ` · ${b.event_type}` : ""}
                  </span>
                  <span>{b.event_location}</span>
                  <span>
                    Renter: <strong>{b.renter?.display_name ?? "Verified renter"}</strong>
                    {" · "}You receive {formatUSD(b.companion_payout_cents / 100)} of{" "}
                    {formatUSD(b.total_cents / 100)}
                    {b.rate_type === "hourly" && b.hours ? ` (${b.hours}h)` : ""}
                  </span>
                </div>
                {b.event_description && <p className="po-hint" style={{ margin: 0 }}>{b.event_description}</p>}
                {b.renter_message && (
                  <p className="po-hint" style={{ margin: 0 }}>
                    <strong>Their message:</strong> {b.renter_message}
                  </p>
                )}

                <RenterClip bookingId={b.id} renterName={b.renter?.display_name ?? "renter"} />

                <div className="po-field" style={{ marginTop: "0.5rem" }}>
                  <label className="po-label" htmlFor={`resp-${b.id}`}>
                    Note for the renter <span style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    id={`resp-${b.id}`}
                    className="po-input"
                    placeholder="Looking forward to it! / Sorry, can't make it…"
                    value={responseMsg[b.id] ?? ""}
                    onChange={(e) =>
                      setResponseMsg((m) => ({ ...m, [b.id]: e.target.value }))
                    }
                    maxLength={1000}
                  />
                </div>

                <div className="po-btn-row">
                  <button
                    type="button"
                    className="po-btn"
                    disabled={actingId === b.id}
                    onClick={() => respond(b.id, "confirm")}
                  >
                    Confirm booking
                  </button>
                  <button
                    type="button"
                    className="po-btn po-btn-danger"
                    disabled={actingId === b.id}
                    onClick={() => respond(b.id, "deny")}
                  >
                    Decline
                  </button>
                  <Link href={`/bookings/${b.id}`} className="po-btn po-btn-secondary">
                    Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
