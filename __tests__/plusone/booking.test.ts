import { describe, it, expect } from "vitest";
import {
  computeBookingTotals,
  computeCancellation,
  CANCELLATION_CUTOFF_HOURS,
} from "@/lib/plusone/booking";

describe("computeBookingTotals", () => {
  it("prices an evening booking flat with an 80/20 split", () => {
    const t = computeBookingTotals("evening", 150);
    expect(t.totalCents).toBe(15000);
    expect(t.companionPayoutCents).toBe(12000);
    expect(t.platformFeeCents).toBe(3000);
    expect(t.hours).toBeNull();
  });

  it("prices an hourly booking by hours with an 80/20 split", () => {
    const t = computeBookingTotals("hourly", 50, 4);
    expect(t.totalCents).toBe(20000);
    expect(t.companionPayoutCents).toBe(16000);
    expect(t.platformFeeCents).toBe(4000);
  });

  it("rounds fractional hours to quarter hours", () => {
    const t = computeBookingTotals("hourly", 60, 2.37);
    expect(t.hours).toBe(2.25);
    expect(t.totalCents).toBe(13500);
  });

  it("keeps every cent accounted for (payout + fee = total)", () => {
    const t = computeBookingTotals("hourly", 55, 3);
    expect(t.companionPayoutCents + t.platformFeeCents).toBe(t.totalCents);
  });

  it("rejects non-positive rates and missing hours", () => {
    expect(() => computeBookingTotals("evening", 0)).toThrow();
    expect(() => computeBookingTotals("hourly", 50)).toThrow();
    expect(() => computeBookingTotals("hourly", 50, -2)).toThrow();
  });
});

describe("computeCancellation", () => {
  const event = new Date("2026-12-01T19:00:00Z");

  it("gives a full refund when the renter cancels 72h+ ahead", () => {
    const now = new Date(event.getTime() - (CANCELLATION_CUTOFF_HOURS + 1) * 3600_000);
    const c = computeCancellation({ totalCents: 15000, cancelledBy: "renter", eventStartsAt: event, now });
    expect(c.refundCents).toBe(15000);
    expect(c.companionPayoutCents).toBe(0);
    expect(c.platformFeeCents).toBe(0);
    expect(c.companionStrike).toBe(false);
  });

  it("splits the forfeited half 80/20 when the renter cancels inside 72h", () => {
    const now = new Date(event.getTime() - 24 * 3600_000);
    const c = computeCancellation({ totalCents: 15000, cancelledBy: "renter", eventStartsAt: event, now });
    // $150 -> $75 refund, $75 forfeited -> $60 companion / $15 platform
    expect(c.refundCents).toBe(7500);
    expect(c.companionPayoutCents).toBe(6000);
    expect(c.platformFeeCents).toBe(1500);
    expect(c.refundCents + c.companionPayoutCents + c.platformFeeCents).toBe(15000);
  });

  it("gives a full refund plus a strike when the companion cancels", () => {
    const now = new Date(event.getTime() - 24 * 3600_000);
    const c = computeCancellation({ totalCents: 15000, cancelledBy: "companion", eventStartsAt: event, now });
    expect(c.refundCents).toBe(15000);
    expect(c.companionPayoutCents).toBe(0);
    expect(c.companionStrike).toBe(true);
  });
});
