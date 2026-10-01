import { describe, it, expect } from "vitest";
import { generateSlots } from "@/lib/plusone/availability";

describe("generateSlots", () => {
  it("returns nothing when no days or timeframes are selected", () => {
    expect(generateSlots({ days: [], timeframes: ["evening"] })).toEqual([]);
    expect(generateSlots({ days: [6], timeframes: [] })).toEqual([]);
  });

  it("creates slots only on the selected weekdays", () => {
    // 2026-10-01 is a Thursday.
    const from = new Date(2026, 9, 1);
    const slots = generateSlots(
      { days: [6], timeframes: ["evening"] },
      from,
      14,
    );
    // Saturdays in the window: Oct 3 and Oct 10.
    expect(slots).toHaveLength(2);
    expect(slots[0].date).toBe("2026-10-03");
    expect(slots[1].date).toBe("2026-10-10");
    expect(slots[0].start_time).toBe("17:00");
    expect(slots[0].end_time).toBe("23:00");
  });

  it("creates one slot per timeframe per matching day", () => {
    const from = new Date(2026, 9, 1); // Thursday
    const slots = generateSlots(
      { days: [5, 6], timeframes: ["daytime", "evening"] },
      from,
      7,
    );
    // Fri Oct 2 + Sat Oct 3, two timeframes each = 4 slots.
    expect(slots).toHaveLength(4);
    const dates = [...new Set(slots.map((s) => s.date))].sort();
    expect(dates).toEqual(["2026-10-02", "2026-10-03"]);
  });

  it("starts tomorrow, never today", () => {
    const from = new Date(2026, 9, 1); // Thursday
    const slots = generateSlots(
      { days: [0, 1, 2, 3, 4, 5, 6], timeframes: ["daytime"] },
      from,
      1,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].date).toBe("2026-10-02");
  });
});
