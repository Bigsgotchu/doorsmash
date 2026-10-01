"use client";

// PlusOne Phase 2: browse verified event companions.
// Browsing is free — no login required.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUSD } from "@/lib/plusone/rates";
import "../become-companion/become-companion.css";
import "../bookings/bookings.css";

interface Companion {
  id: string;
  bio: string | null;
  interests: string[];
  hourly_rate: number | null;
  evening_rate: number | null;
  rating_avg: number;
  total_bookings: number;
  display_name: string;
  primary_photo_url: string | null;
}

export default function BrowseCompanionsPage() {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/companions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load companions.");
      setCompanions(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load companions.");
    } finally {
      setLoading(false);
    }
  }, [date, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state set after await
    void load();
  }, [load]);

  return (
    <main className="po-shell">
      <div className="po-wrap">
        <p className="po-eyebrow">PlusOne · Salt Lake City</p>
        <h1 className="po-title">Find your plus-one</h1>
        <p className="po-sub">
          Verified humans, ready for weddings, galas, parties, and everything
          in between. Never go alone again.
        </p>

        <form
          className="po-filters"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="po-field">
            <label className="po-label" htmlFor="browse-date">
              Event date
            </label>
            <input
              id="browse-date"
              type="date"
              className="po-input"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="po-field" style={{ flex: 1, minWidth: 200 }}>
            <label className="po-label" htmlFor="browse-q">
              Search
            </label>
            <input
              id="browse-q"
              type="search"
              className="po-input"
              placeholder="Try “weddings” or “live music”…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="po-field" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="po-btn">
              Search
            </button>
          </div>
        </form>

        {error && <p className="po-error">{error}</p>}

        {loading ? (
          <p className="po-hint">Loading companions…</p>
        ) : companions.length === 0 ? (
          <div className="po-empty">
            <h2>No companions found</h2>
            <p>
              {date
                ? "Nobody is available on that date yet — try another day."
                : "New companions are being verified every day. Check back soon."}
            </p>
            <Link href="/become-companion" className="po-btn po-btn-secondary">
              Become a companion
            </Link>
          </div>
        ) : (
          <div className="po-grid">
            {companions.map((c) => (
              <article key={c.id} className="po-card">
                {c.primary_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URL, not optimizable
                  <img
                    src={c.primary_photo_url}
                    alt={c.display_name}
                    className="po-card-photo"
                  />
                ) : (
                  <div className="po-card-photo-fallback" aria-hidden="true">
                    ✨
                  </div>
                )}
                <div className="po-card-body">
                  <h2 className="po-card-name">{c.display_name}</h2>
                  <p className="po-verified-badge">✓ Verified human</p>
                  {c.bio && (
                    <p className="po-hint" style={{ margin: 0 }}>
                      {c.bio.length > 110 ? c.bio.slice(0, 110) + "…" : c.bio}
                    </p>
                  )}
                  <div className="po-card-rates">
                    {c.hourly_rate != null && (
                      <span>
                        <strong>{formatUSD(Number(c.hourly_rate))}</strong>/hr
                      </span>
                    )}
                    {c.evening_rate != null && (
                      <span>
                        <strong>{formatUSD(Number(c.evening_rate))}</strong>/evening
                      </span>
                    )}
                  </div>
                  <Link href={`/companions/${c.id}`} className="po-btn po-btn-secondary">
                    View profile
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
