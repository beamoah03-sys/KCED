import { z } from "zod";

/** Enum lists mirror the Postgres enums in 20261112000200_energy_schema.sql. */

export const BUILDING_CATEGORIES = [
  { dbValue: "academic", label: "Academic" },
  { dbValue: "administrative", label: "Administrative" },
  { dbValue: "residential", label: "Residential" },
  { dbValue: "health", label: "Health" },
  { dbValue: "commercial", label: "Commercial" },
  { dbValue: "sports", label: "Sports" },
  { dbValue: "utility", label: "Utility" },
  { dbValue: "other", label: "Other" },
] as const;
export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number]["dbValue"];

export const METER_UTILITIES = [
  { dbValue: "grid", label: "ECG grid" },
  { dbValue: "generator", label: "Generator" },
  { dbValue: "solar", label: "Solar PV" },
  { dbValue: "other", label: "Other" },
] as const;
export type MeterUtility = (typeof METER_UTILITIES)[number]["dbValue"];

export const METER_KINDS = [
  { dbValue: "prepaid", label: "Prepaid" },
  { dbValue: "postpaid", label: "Postpaid" },
  { dbValue: "smart", label: "Smart" },
  { dbValue: "sub_meter", label: "Sub-meter" },
] as const;
export type MeterKind = (typeof METER_KINDS)[number]["dbValue"];

export const OUTAGE_CAUSES = [
  { dbValue: "ecg_supply", label: "ECG supply" },
  { dbValue: "internal_fault", label: "Internal fault" },
  { dbValue: "planned", label: "Planned" },
  { dbValue: "unknown", label: "Unknown" },
] as const;
export type OutageCause = (typeof OUTAGE_CAUSES)[number]["dbValue"];

export function labelOf<T extends string>(list: readonly { dbValue: T; label: string }[], value: string): string {
  return list.find((x) => x.dbValue === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface Building {
  id: string;
  code: string;
  name: string;
  jurisdictionId: number;
  jurisdictionName: string | null;
  category: BuildingCategory;
  floorAreaM2: number | null;
  occupants: number | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export interface Meter {
  id: string;
  meterNumber: string;
  buildingId: string;
  buildingName: string | null;
  buildingCode: string | null;
  jurisdictionId: number;
  utility: MeterUtility;
  kind: MeterKind;
  ecgAccountNumber: string | null;
  multiplier: number;
  installedOn: string | null;
  isActive: boolean;
  notes: string | null;
  /** Latest reading, joined for the list. */
  lastReadingKwh: number | null;
  lastReadingAt: string | null;
}

export interface MeterReading {
  id: string;
  meterId: string;
  readingAt: string;
  readingKwh: number;
  source: "manual" | "import" | "api";
  notes: string | null;
  recordedByName: string | null;
}

export interface Bill {
  id: string;
  meterId: string | null;
  meterNumber: string | null;
  buildingId: string | null;
  buildingName: string | null;
  jurisdictionId: number;
  accountNumber: string | null;
  periodStart: string;
  periodEnd: string;
  consumptionKwh: number | null;
  maxDemandKva: number | null;
  amountGhs: number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
}

export interface Outage {
  id: string;
  jurisdictionId: number;
  jurisdictionName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  startedAt: string;
  endedAt: string | null;
  cause: OutageCause;
  generatorUsed: boolean;
  generatorHours: number | null;
  description: string | null;
  durationHours: number;
}

// ---------------------------------------------------------------------------
// Form schemas (validate the forms AND infer their types)
// ---------------------------------------------------------------------------

const optionalNumber = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), message)
    .transform((v) => (v === "" ? null : Number(v)));

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

export const buildingSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "2-20 capital letters, digits or dashes, e.g. COE-PB."),
  name: z.string().trim().min(1, "Enter the building name."),
  jurisdiction_id: z.number({ error: "Select a jurisdiction." }).int().positive("Select a jurisdiction."),
  category: z.enum(BUILDING_CATEGORIES.map((c) => c.dbValue) as [BuildingCategory, ...BuildingCategory[]]),
  floor_area_m2: optionalNumber("Floor area must be a positive number."),
  occupants: optionalNumber("Occupants must be a positive number."),
  latitude: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) >= -90 && Number(v) <= 90), "Latitude is between -90 and 90.")
    .transform((v) => (v === "" ? null : Number(v))),
  longitude: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) >= -180 && Number(v) <= 180), "Longitude is between -180 and 180.")
    .transform((v) => (v === "" ? null : Number(v))),
  notes: optionalText,
});
export type BuildingFormInput = z.input<typeof buildingSchema>;
export type BuildingFormValues = z.output<typeof buildingSchema>;

export const meterSchema = z.object({
  meter_number: z.string().trim().min(2, "Enter the meter number."),
  building_id: z.string().uuid("Select a building."),
  utility: z.enum(METER_UTILITIES.map((u) => u.dbValue) as [MeterUtility, ...MeterUtility[]]),
  kind: z.enum(METER_KINDS.map((k) => k.dbValue) as [MeterKind, ...MeterKind[]]),
  ecg_account_number: optionalText,
  multiplier: z
    .string()
    .trim()
    .refine((v) => v === "" || Number(v) > 0, "Multiplier must be greater than 0.")
    .transform((v) => (v === "" ? 1 : Number(v))),
  installed_on: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date.")
    .transform((v) => (v === "" ? null : v)),
  notes: optionalText,
});
export type MeterFormInput = z.input<typeof meterSchema>;
export type MeterFormValues = z.output<typeof meterSchema>;

export const readingSchema = z.object({
  reading_at: z.string().min(1, "Pick the date and time of the reading."),
  reading_kwh: z
    .string()
    .trim()
    .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter the register value in kWh.")
    .transform(Number),
  notes: optionalText,
});
export type ReadingFormInput = z.input<typeof readingSchema>;
export type ReadingFormValues = z.output<typeof readingSchema>;

export const billSchema = z
  .object({
    meter_id: z.string().uuid("Select a meter."),
    period_start: isoDate,
    period_end: isoDate,
    consumption_kwh: optionalNumber("kWh must be a positive number."),
    max_demand_kva: optionalNumber("Max demand must be a positive number."),
    amount_ghs: z
      .string()
      .trim()
      .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter the amount in GHS.")
      .transform(Number),
    due_date: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v)),
    paid_at: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v)),
    notes: optionalText,
  })
  .refine((b) => b.period_end >= b.period_start, {
    message: "The period must end on or after its start.",
    path: ["period_end"],
  });
export type BillFormInput = z.input<typeof billSchema>;
export type BillFormValues = z.output<typeof billSchema>;

export const outageSchema = z
  .object({
    jurisdiction_id: z.number({ error: "Select a jurisdiction." }).int().positive("Select a jurisdiction."),
    building_id: z.string().transform((v) => (v === "" || v === "none" ? null : v)),
    started_at: z.string().min(1, "When did the power go off?"),
    ended_at: z.string().transform((v) => (v === "" ? null : v)),
    cause: z.enum(OUTAGE_CAUSES.map((c) => c.dbValue) as [OutageCause, ...OutageCause[]]),
    generator_used: z.boolean(),
    generator_hours: optionalNumber("Generator hours must be a positive number."),
    description: optionalText,
  })
  .refine((o) => !o.ended_at || new Date(o.ended_at) >= new Date(o.started_at), {
    message: "Power cannot come back before it went off.",
    path: ["ended_at"],
  });
export type OutageFormInput = z.input<typeof outageSchema>;
export type OutageFormValues = z.output<typeof outageSchema>;
