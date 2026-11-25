import type { ImportValidation } from "@/components/CsvImportDialog";
import type { Meter } from "@/features/energy/schema";
import type { ReadingImportRow } from "@/features/energy/services/energy.service";

/** Validate a readings CSV: meter_number, reading_at (ISO date/time), reading_kwh, notes. */
export function validateReadingRows(
  rows: Record<string, string>[],
  meters: Meter[],
): ImportValidation<ReadingImportRow> {
  const byNumber = new Map(meters.map((m) => [m.meterNumber.toUpperCase(), m]));
  const valid: ReadingImportRow[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const line = `Row ${i + 2}`;
    const meter = byNumber.get((row.meter_number ?? "").toUpperCase());
    const at = new Date(row.reading_at ?? "");
    const kwh = Number(row.reading_kwh);
    const problems: string[] = [];
    if (!meter) problems.push(`unknown meter_number '${row.meter_number ?? ""}'`);
    if (!row.reading_at || Number.isNaN(at.getTime())) problems.push("reading_at must be a date like 2026-11-01 08:00");
    else if (at.getTime() > Date.now() + 86_400_000) problems.push("reading_at is in the future");
    if (row.reading_kwh === undefined || row.reading_kwh === "" || Number.isNaN(kwh) || kwh < 0)
      problems.push("reading_kwh must be a number ≥ 0");
    if (problems.length > 0 || !meter) {
      errors.push(`${line}: ${problems.join("; ")}`);
      return;
    }
    valid.push({ meterId: meter.id, readingAt: at.toISOString(), readingKwh: kwh, notes: row.notes || null });
  });
  return { valid, errors };
}
