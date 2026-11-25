import { describe, expect, it } from "vitest";
import { bucketByDay } from "@/features/dashboard/services/dashboard.service";

describe("bucketByDay", () => {
  it("counts the last day of the month (Phase I dropped it)", () => {
    const local = (d: number, h: number) => new Date(2026, 9, d, h).toISOString(); // October 2026, local time
    const buckets = bucketByDay([local(1, 9), local(31, 9), local(31, 23)], 2026, 9);
    expect(buckets).toHaveLength(31);
    expect(buckets[0].count).toBe(1);
    expect(buckets[30].count).toBe(2);
  });

  it("ignores timestamps from other months", () => {
    const buckets = bucketByDay([new Date(2026, 10, 1, 9).toISOString()], 2026, 9);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });
});
