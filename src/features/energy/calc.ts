/**
 * Pure energy calculations, shared by the pages and covered by unit tests.
 * The database computes the same numbers in the `meter_consumption` and
 * `building_monthly_energy` views; these mirror that logic for the browser.
 */

export interface RegisterReading {
  readingAt: string;
  readingKwh: number;
}

export interface ConsumptionPeriod {
  from: string;
  to: string;
  kwh: number;
}

/**
 * Consumption between consecutive register readings, times the meter
 * multiplier. A falling register (meter reset or replaced) counts as zero.
 */
export function consumptionFromReadings(readings: RegisterReading[], multiplier = 1): ConsumptionPeriod[] {
  const sorted = [...readings].sort((a, b) => a.readingAt.localeCompare(b.readingAt));
  const periods: ConsumptionPeriod[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].readingKwh - sorted[i - 1].readingKwh;
    periods.push({
      from: sorted[i - 1].readingAt,
      to: sorted[i].readingAt,
      kwh: round2(Math.max(delta, 0) * multiplier),
    });
  }
  return periods;
}

/** The last `count` calendar months as "YYYY-MM-01", oldest first. */
export function lastMonths(count: number, now = new Date()): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 10));
  }
  return months;
}

/** Sum values by month key, filling missing months with 0. */
export function sumByMonth<T>(
  rows: T[],
  months: string[],
  month: (row: T) => string,
  value: (row: T) => number,
): { month: string; value: number }[] {
  const totals = new Map(months.map((m) => [m, 0]));
  for (const row of rows) {
    const key = month(row).slice(0, 7) + "-01";
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + value(row));
  }
  return months.map((m) => ({ month: m, value: round2(totals.get(m) ?? 0) }));
}

/**
 * Energy use intensity in kWh per m² per year: the standard way to compare
 * buildings of different sizes. Null when area or data is missing.
 */
export function energyUseIntensity(annualKwh: number, floorAreaM2: number | null): number | null {
  if (!floorAreaM2 || floorAreaM2 <= 0) return null;
  return round2(annualKwh / floorAreaM2);
}

/** Hours between two timestamps; an open outage counts up to `now`. */
export function durationHours(start: string, end: string | null, now = new Date()): number {
  const ms = (end ? new Date(end) : now).getTime() - new Date(start).getTime();
  return round2(Math.max(ms, 0) / 3_600_000);
}

/**
 * Flag a month as unusual when it is more than `threshold` above the average
 * of the previous months that had data (simple, explainable alerting).
 */
export function isUnusualRise(series: number[], threshold = 0.3): boolean {
  if (series.length < 3) return false;
  const latest = series[series.length - 1];
  const previous = series.slice(0, -1).filter((v) => v > 0);
  if (previous.length < 2) return false;
  const avg = previous.reduce((a, b) => a + b, 0) / previous.length;
  return avg > 0 && latest > avg * (1 + threshold);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const kwhFormat = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });
const ghsFormat = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

export const formatKwh = (n: number | null | undefined) => (n == null ? "—" : `${kwhFormat.format(n)} kWh`);
export const formatGhs = (n: number | null | undefined) => (n == null ? "—" : ghsFormat.format(n));

/** "Nov 2026" from "2026-11-01". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
