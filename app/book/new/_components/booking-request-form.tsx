"use client";

// PlusOne Phase 2: the booking request form.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeBookingTotals, defaultEndTime, timesOverlap, type RateType } from "@/lib/plusone/booking";
import { formatUSD, companionReceives } from "@/lib/plusone/rates";

interface CompanionInfo {
  id: string;
  displayName: string;
  photoUrl: string | null;
  hourlyRate: number | null;
  eveningRate: number | null;
}

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

const EVENT_TYPES = [
  "Wedding",
  "Gala / fundraiser",
  "Work event",
  "Party",
  "Dinner",
  "Concert / show",
  "Sporting event",
  "Other",
];

export default function BookingRequestForm({
  companion,
  openSlots,
  isVerified,
}: {
  companion: CompanionInfo;
  openSlots: Slot[];
  isVerified: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [rateType, setRateType] = useState<RateType>(
    companion.eveningRate != null ? "evening" : "hourly",
  );
  const [hours, setHours] = useState("4");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveEnd = endTime || defaultEndTime(startTime);

  const slotCovered = useMemo(() => {
    if (!eventDate) return null;
    return openSlots.some(
      (s) =>
        s.date === eventDate &&
        timesOverlap(startTime, effectiveEnd, s.startTime, s.endTime),
    );
  }, [eventDate, startTime, effectiveEnd, openSlots]);

  const totals = useMemo(() => {
    try {
      const rate = rateType === "hourly" ? companion.hourlyRate : companion.eveningRate;
      if (rate == null) return null;
      return computeBookingTotals(
        rateType,
        rate,
        rateType === "hourly" ? Number(hours) : undefined,
      );
    } catch {
      return null;
    }
  }, [rateType, hours, companion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventTitle.trim() || !eventDate || !location.trim()) {
      setError("Give your event a title, date, and location.");
      return;
    }
    if (slotCovered === false) {
      setError(`${companion.displayName} isn't available at that time. Pick another slot.`);
      return;
    }
    if (!totals) {
      setError("Check the rate and hours — something doesn't add up.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companion_id: companion.id,
          event_title: eventTitle.trim(),
          event_type: eventType,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime || undefined,
          event_location: location.trim(),
          event_description: description.trim() || undefined,
          rate_type: rateType,
          hours: rateType === "hourly" ? Number(hours) : undefined,
          renter_message: message.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "verification_required") {
          router.push("/verify-identity?next=" + encodeURIComponent(window.location.pathname + window.location.search));
          return;
        }
        throw new Error(json.error ?? "Could not send the request.");
      }
      router.push(`/bookings/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
      setSubmitting(false);
    }
  }

  return (
    <form className="po-form" onSubmit={handleSubmit}>
      {!isVerified && (
        <p className="po-hint">
          Heads up: requesting a booking requires verified identity (ID +
          video clip). You can{" "}
          <Link href="/verify-identity">verify now</Link> or we&apos;ll send
          you there when you submit.
        </p>
      )}
      {error && <p className="po-error">{error}</p>}

      <div className="po-field">
        <label className="po-label" htmlFor="br-title">Event title</label>
        <input
          id="br-title"
          className="po-input"
          placeholder="e.g. Sarah's wedding reception"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          maxLength={120}
        />
      </div>

      <div className="po-form-row">
        <div className="po-field">
          <label className="po-label" htmlFor="br-type">Event type</label>
          <select
            id="br-type"
            className="po-select"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="po-field">
          <label className="po-label" htmlFor="br-date">Date</label>
          <input
            id="br-date"
            type="date"
            className="po-input"
            value={eventDate}
            min={today}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>

      <div className="po-form-row">
        <div className="po-field">
          <label className="po-label" htmlFor="br-start">Start time</label>
          <input
            id="br-start"
            type="time"
            className="po-input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="po-field">
          <label className="po-label" htmlFor="br-end">
            End time <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="br-end"
            type="time"
            className="po-input"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder={defaultEndTime(startTime)}
          />
        </div>
      </div>

      {eventDate && slotCovered === false && (
        <p className="po-error">
          {companion.displayName} has no open availability covering that time.
        </p>
      )}

      <div className="po-field">
        <label className="po-label" htmlFor="br-location">Location</label>
        <input
          id="br-location"
          className="po-input"
          placeholder="Venue name + address"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="po-field">
        <label className="po-label" htmlFor="br-desc">
          Event details <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="br-desc"
          className="po-textarea"
          placeholder="Dress code, parking, anything your plus-one should know…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div className="po-field">
        <span className="po-label">Rate</span>
        <div className="po-radio-cards">
          {companion.hourlyRate != null && (
            <label className="po-radio-card">
              <input
                type="radio"
                name="rateType"
                checked={rateType === "hourly"}
                onChange={() => setRateType("hourly")}
              />
              {formatUSD(companion.hourlyRate)}/hour
            </label>
          )}
          {companion.eveningRate != null && (
            <label className="po-radio-card">
              <input
                type="radio"
                name="rateType"
                checked={rateType === "evening"}
                onChange={() => setRateType("evening")}
              />
              {formatUSD(companion.eveningRate)}/evening
            </label>
          )}
        </div>
      </div>

      {rateType === "hourly" && (
        <div className="po-field">
          <label className="po-label" htmlFor="br-hours">Hours</label>
          <input
            id="br-hours"
            type="number"
            className="po-input"
            min={1}
            max={24}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      )}

      {totals && (
        <div className="po-price-box" aria-live="polite">
          <div className="po-price-row po-price-total">
            <span>Your total</span>
            <span>{formatUSD(totals.totalCents / 100)}</span>
          </div>
          <p className="po-fine" style={{ margin: 0 }}>
            One price, no hidden fees. {companion.displayName} receives{" "}
            {formatUSD(companionReceives(totals.totalCents / 100))} (80%).
            Payment happens after confirmation — we&apos;ll send a secure link.
          </p>
        </div>
      )}

      <div className="po-field">
        <label className="po-label" htmlFor="br-msg">
          Message to {companion.displayName} <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="br-msg"
          className="po-textarea"
          placeholder="Introduce yourself — who you are, what the event is like…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
        />
      </div>

      <button type="submit" className="po-btn" disabled={submitting}>
        {submitting ? "Sending…" : "Send booking request"}
      </button>
      <p className="po-fine">
        Strictly platonic, always. By requesting you agree to PlusOne&apos;s
        community standards.
      </p>
    </form>
  );
}
