import { TIMEFRAMES, AVAILABILITY_WINDOW_DAYS } from "./constants";

export interface AvailabilitySelection {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** timeframe ids, e.g. ["daytime", "evening"] */
  timeframes: string[];
}

export interface GeneratedSlot {
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Expand a weekly availability selection (days + timeframes) into concrete
 * open slots for the next `daysOut` days, starting tomorrow.
 * Pure function — safe to unit test.
 */
export function generateSlots(
  selection: AvailabilitySelection,
  fromDate: Date = new Date(),
  daysOut: number = AVAILABILITY_WINDOW_DAYS,
): GeneratedSlot[] {
  if (selection.days.length === 0 || selection.timeframes.length === 0) {
    return [];
  }

  const frames = TIMEFRAMES.filter((t) =>
    selection.timeframes.includes(t.id),
  );
  if (frames.length === 0) return [];

  const slots: GeneratedSlot[] = [];
  const cursor = new Date(fromDate);
  cursor.setDate(cursor.getDate() + 1); // start tomorrow

  for (let i = 0; i < daysOut; i++) {
    if (selection.days.includes(cursor.getDay())) {
      const date = toISODate(cursor);
      for (const f of frames) {
        slots.push({ date, start_time: f.start, end_time: f.end });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}
