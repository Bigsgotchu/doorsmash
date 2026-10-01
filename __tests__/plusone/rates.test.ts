import { describe, it, expect } from "vitest";
import {
  companionReceives,
  platformFee,
  formatUSD,
  validateRates,
} from "@/lib/plusone/rates";

describe("PlusOne money model", () => {
  it("splits 80/20 on a $150 evening booking", () => {
    expect(companionReceives(150)).toBe(120);
    expect(platformFee(150)).toBe(30);
  });

  it("splits 80/20 on an hourly booking", () => {
    expect(companionReceives(50)).toBe(40);
    expect(platformFee(50)).toBe(10);
  });

  it("rounds to cents", () => {
    expect(companionReceives(99.99)).toBe(79.99);
    expect(platformFee(99.99)).toBe(20);
  });

  it("formats USD without decimals for whole dollars", () => {
    expect(formatUSD(150)).toBe("$150");
    expect(formatUSD(99.99)).toBe("$99.99");
  });

  it("requires at least one rate", () => {
    expect(validateRates({})).toHaveLength(1);
    expect(validateRates({ hourly_rate: null, evening_rate: null })).toHaveLength(1);
  });

  it("enforces the platform floors", () => {
    expect(validateRates({ hourly_rate: 40 })).toContainEqual(
      expect.stringContaining("$50"),
    );
    expect(validateRates({ evening_rate: 100 })).toContainEqual(
      expect.stringContaining("$150"),
    );
  });

  it("accepts valid rates at or above the floor", () => {
    expect(validateRates({ hourly_rate: 50 })).toEqual([]);
    expect(validateRates({ evening_rate: 150 })).toEqual([]);
    expect(validateRates({ hourly_rate: 75, evening_rate: 200 })).toEqual([]);
  });
});
