// PlusOne booking money model + cancellation policy.
// Companion sets a rate; the renter sees one total price; the companion
// receives 80% and the platform keeps 20% (processing baked in).

import { COMPANION_SHARE_RATE } from "./constants";
import { formatUSD } from "./rates";

export type RateType = "hourly" | "evening";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "denied"
  | "cancelled_by_renter"
  | "cancelled_by_companion"
  | "completed";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Awaiting companion",
  confirmed: "Confirmed",
  denied: "Declined",
  cancelled_by_renter: "Cancelled by you",
  cancelled_by_companion: "Cancelled by companion",
  completed: "Completed",
};

export interface BookingTotals {
  rateType: RateType;
  rateCents: number;
  hours: number | null;
  totalCents: number;
  companionPayoutCents: number;
  platformFeeCents: number;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Snapshot the money for a booking request.
 * Hourly: total = rate × hours. Evening: total = flat rate.
 * Companion receives 80% of the total; the platform keeps the rest.
 */
export function computeBookingTotals(
  rateType: RateType,
  rateDollars: number,
  hours?: number,
): BookingTotals {
  if (!Number.isFinite(rateDollars) || rateDollars <= 0) {
    throw new Error("Rate must be a positive number.");
  }
  const rateCents = toCents(rateDollars);
  let totalCents: number;
  let wholeHours: number | null = null;
  if (rateType === "hourly") {
    if (!hours || !Number.isFinite(hours) || hours <= 0) {
      throw new Error("Hours must be a positive number for hourly bookings.");
    }
    wholeHours = Math.round(hours * 4) / 4; // quarter-hour granularity
    totalCents = Math.round(rateCents * wholeHours);
  } else {
    totalCents = rateCents;
  }
  const companionPayoutCents = Math.round(totalCents * COMPANION_SHARE_RATE);
  return {
    rateType,
    rateCents,
    hours: wholeHours,
    totalCents,
    companionPayoutCents,
    platformFeeCents: totalCents - companionPayoutCents,
  };
}

export interface CancellationOutcome {
  refundCents: number;
  companionPayoutCents: number;
  platformFeeCents: number;
  companionStrike: boolean;
  summary: string;
}

export const CANCELLATION_CUTOFF_HOURS = 72;

/**
 * Official cancellation policy (confirmed Sep 30, 2026):
 * - Renter cancels 72h+ before the event: full refund, nobody is paid.
 * - Renter cancels inside 72h: 50% refund; the forfeited half splits 80/20.
 * - Companion cancels or no-shows: renter gets a full refund, companion
 *   takes a strike (3 strikes = automatic suspension).
 */
export function computeCancellation(opts: {
  totalCents: number;
  cancelledBy: "renter" | "companion";
  eventStartsAt: Date;
  now?: Date;
}): CancellationOutcome {
  const { totalCents, cancelledBy, eventStartsAt } = opts;
  const now = opts.now ?? new Date();
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("totalCents must be a positive integer.");
  }

  if (cancelledBy === "companion") {
    return {
      refundCents: totalCents,
      companionPayoutCents: 0,
      platformFeeCents: 0,
      companionStrike: true,
      summary: `Full refund of ${formatUSD(totalCents / 100)} — the companion cancelled.`,
    };
  }

  const msUntil = eventStartsAt.getTime() - now.getTime();
  const hoursUntil = msUntil / (1000 * 60 * 60);

  if (hoursUntil >= CANCELLATION_CUTOFF_HOURS) {
    return {
      refundCents: totalCents,
      companionPayoutCents: 0,
      platformFeeCents: 0,
      companionStrike: false,
      summary: `Full refund of ${formatUSD(totalCents / 100)} — cancelled ${CANCELLATION_CUTOFF_HOURS}+ hours ahead.`,
    };
  }

  const refundCents = Math.floor(totalCents / 2);
  const forfeited = totalCents - refundCents;
  const companionPayoutCents = Math.round(forfeited * COMPANION_SHARE_RATE);
  return {
    refundCents,
    companionPayoutCents,
    platformFeeCents: forfeited - companionPayoutCents,
    companionStrike: false,
    summary:
      `Refund of ${formatUSD(refundCents / 100)} — cancelled inside ${CANCELLATION_CUTOFF_HOURS} hours. ` +
      `The companion keeps ${formatUSD(companionPayoutCents / 100)} for holding your date.`,
  };
}

/** Human-friendly "X days, Y hours" until the event. */
export function timeUntil(eventStartsAt: Date, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((eventStartsAt.getTime() - now.getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/** Combine a booking's event_date + start_time into a Date. */
export function bookingStartsAt(eventDate: string, startTime: string): Date {
  // startTime may be "HH:MM" (form) or "HH:MM:SS" (DB); normalise to HH:MM
  const t = startTime.length >= 5 ? startTime.slice(0, 5) : startTime;
  return new Date(`${eventDate}T${t}:00`);
}

/** Default event end: 4 hours after start, for overlap checks. */
export function defaultEndTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const endH = (h + 4) % 24;
  return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** True when two [start, end) "HH:MM" time ranges overlap. */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
