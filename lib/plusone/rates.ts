import {
  COMPANION_SHARE_RATE,
  PLATFORM_FEE_RATE,
  MIN_HOURLY_RATE,
  MIN_EVENING_RATE,
} from "./constants";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** What the companion receives from a gross booking amount (80%). */
export function companionReceives(gross: number): number {
  return round2(gross * COMPANION_SHARE_RATE);
}

/** What the platform keeps from a gross booking amount (20%, processing baked in). */
export function platformFee(gross: number): number {
  return round2(gross * PLATFORM_FEE_RATE);
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export interface RateInput {
  hourly_rate?: number | null;
  evening_rate?: number | null;
}

/**
 * Validate companion rates against the official money model:
 * at least one rate set, each at or above the platform floor.
 * Returns a list of human-readable error messages (empty = valid).
 */
export function validateRates(input: RateInput): string[] {
  const errors: string[] = [];
  const { hourly_rate, evening_rate } = input;

  const hourlySet = hourly_rate !== undefined && hourly_rate !== null;
  const eveningSet = evening_rate !== undefined && evening_rate !== null;

  if (!hourlySet && !eveningSet) {
    errors.push("Set at least one rate (hourly or per evening).");
    return errors;
  }

  if (hourlySet) {
    if (!Number.isFinite(hourly_rate)) {
      errors.push("Hourly rate must be a number.");
    } else if ((hourly_rate as number) < MIN_HOURLY_RATE) {
      errors.push(
        `Hourly rate must be at least ${formatUSD(MIN_HOURLY_RATE)} (platform minimum).`,
      );
    }
  }

  if (eveningSet) {
    if (!Number.isFinite(evening_rate)) {
      errors.push("Evening rate must be a number.");
    } else if ((evening_rate as number) < MIN_EVENING_RATE) {
      errors.push(
        `Evening rate must be at least ${formatUSD(MIN_EVENING_RATE)} (platform minimum).`,
      );
    }
  }

  return errors;
}
