"use client";

// PlusOne Phase 2: my bookings — as a renter and as a companion.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/plusone/booking";
import { formatUSD } from "@/lib/plusone/rates";
import "../become-companion/become-companion.css";
import "./bookings.css";

interface Booking {
  id: string;
  status: BookingStatus;
  event_title: string;
  event_type: string | null;
  event_date: string;
  start_time: string;
  total_cents: number;
  companion_payout_cents: number;
  renter: { display_name: string | null; primary_photo_url: string | null } | null;
  companion: { display_name: string | null; primary_photo_url: string | null } | null;
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BookingCard({ booking, other }: { booking: Booking; other: Booking["renter"] }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="po-booking-card"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="po-booking-top">
        <h3 className="po-booking-title">{booking.event_title}</h3>
        <span className={`po-status po-status-${booking.status}`}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </span>
      </div>
      <div className="po-booking-meta">
        <span>
          {formatDate(booking.event_date)} · {booking.start_time.slice(0, 5)}
          {booking.event_type ? ` · ${booking.event_type}` : ""}
        </span>
        <span>
          With {other?.display_name ?? "your plus-one"} ·{" "}
          {formatUSD(booking.total_cents / 100)} total
        </span>
      </div>
    </Link>
  );
}

export default function BookingsPage() {
  const [asRenter, setAsRenter] = useState<Booking[]>([]);
  const [asCompanion, setAsCompanion] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/bookings");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load bookings.");
        setAsRenter(json.asRenter ?? []);
        setAsCompanion(json.asCompanion ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load bookings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="po-shell">
      <div className="po-wrap">
        <p className="po-eyebrow">PlusOne</p>
        <h1 className="po-title">My bookings</h1>

        {error && <p className="po-error">{error}</p>}

        {loading ? (
          <p className="po-hint">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="po-h">As a renter</h2>
              {asRenter.length === 0 ? (
                <div className="po-empty">
                  <p>No bookings yet. Find someone great to bring along.</p>
                  <Link href="/companions" className="po-btn">
                    Browse companions
                  </Link>
                </div>
              ) : (
                <div className="po-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {asRenter.map((b) => (
                    <BookingCard key={b.id} booking={b} other={b.companion} />
                  ))}
                </div>
              )}
            </section>

            {asCompanion.length > 0 && (
              <section style={{ marginTop: "2rem" }}>
                <h2 className="po-h">As a companion</h2>
                <div className="po-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {asCompanion.map((b) => (
                    <BookingCard key={b.id} booking={b} other={b.renter} />
                  ))}
                </div>
                <p style={{ marginTop: "1rem" }}>
                  <Link href="/companion/requests" className="po-btn po-btn-secondary">
                    Review incoming requests
                  </Link>
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
