import { describe, expect, it } from "vitest";
import {
  consumptionFromReadings,
  durationHours,
  energyUseIntensity,
  isUnusualRise,
  lastMonths,
  sumByMonth,
} from "@/features/energy/calc";

describe("consumptionFromReadings", () => {
  it("computes deltas between sorted readings with the multiplier", () => {
    const periods = consumptionFromReadings(
      [
        { readingAt: "2026-10-31T00:00:00Z", readingKwh: 1500 },
        { readingAt: "2026-09-30T00:00:00Z", readingKwh: 1000 },
        { readingAt: "2026-11-10T00:00:00Z", readingKwh: 1600 },
      ],
      2,
    );
    expect(periods.map((p) => p.kwh)).toEqual([1000, 200]);
  });

  it("treats a falling register (meter replaced) as zero", () => {
    const periods = consumptionFromReadings([
      { readingAt: "2026-01-01", readingKwh: 9000 },
      { readingAt: "2026-02-01", readingKwh: 50 },
    ]);
    expect(periods[0].kwh).toBe(0);
  });
});

describe("lastMonths and sumByMonth", () => {
  it("lists months oldest first and fills gaps with zero", () => {
    const months = lastMonths(3, new Date("2026-11-15T00:00:00Z"));
    expect(months).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    const totals = sumByMonth(
      [
        { m: "2026-11-01", v: 5 },
        { m: "2026-11-01", v: 7 },
        { m: "2026-01-01", v: 99 },
      ],
      months,
      (r) => r.m,
      (r) => r.v,
    );
    expect(totals).toEqual([
      { month: "2026-09-01", value: 0 },
      { month: "2026-10-01", value: 0 },
      { month: "2026-11-01", value: 12 },
    ]);
  });
});

describe("energyUseIntensity", () => {
  it("divides annual kWh by floor area", () => {
    expect(energyUseIntensity(650_000, 6500)).toBe(100);
  });
  it("returns null without a floor area", () => {
    expect(energyUseIntensity(1000, null)).toBeNull();
  });
});

describe("durationHours", () => {
  it("measures closed outages", () => {
    expect(durationHours("2026-11-01T08:00:00Z", "2026-11-01T11:30:00Z")).toBe(3.5);
  });
  it("counts open outages up to now", () => {
    expect(durationHours("2026-11-01T08:00:00Z", null, new Date("2026-11-01T10:00:00Z"))).toBe(2);
  });
});

describe("isUnusualRise", () => {
  it("flags a month 30%+ above the previous average", () => {
    expect(isUnusualRise([100, 100, 100, 140])).toBe(true);
    expect(isUnusualRise([100, 100, 100, 120])).toBe(false);
  });
  it("needs enough history", () => {
    expect(isUnusualRise([0, 0, 500])).toBe(false);
  });
});
