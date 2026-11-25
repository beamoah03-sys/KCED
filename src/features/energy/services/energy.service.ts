import { errorMessage, fetchAllRows, supabase } from "@/lib/supabase";
import type { UserRole } from "@/features/profile/services/profile.service";
import type {
  Bill,
  BillFormValues,
  Building,
  BuildingFormValues,
  Meter,
  MeterFormValues,
  MeterReading,
  Outage,
  OutageFormValues,
  ReadingFormValues,
} from "@/features/energy/schema";
import { durationHours } from "@/features/energy/calc";

/**
 * Data access for the energy layer: buildings, meters, readings, bills and
 * outages. RLS scopes rows on the server; the `role`/`jurisdictionId`
 * arguments only narrow lists for non-admins, like the Phase I services.
 */

const scopedTo = (role: UserRole | null, jurisdictionId: number | null) =>
  role && role !== "admin" && jurisdictionId != null ? jurisdictionId : null;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

const mapBuilding = (r: Row): Building => ({
  id: r.id,
  code: r.code,
  name: r.name,
  jurisdictionId: r.jurisdiction_id,
  jurisdictionName: r.jurisdictions?.name ?? null,
  category: r.category,
  floorAreaM2: r.floor_area_m2 != null ? Number(r.floor_area_m2) : null,
  occupants: r.occupants ?? null,
  latitude: r.latitude ?? null,
  longitude: r.longitude ?? null,
  notes: r.notes ?? null,
});

export async function fetchBuildings(
  role: UserRole | null = null,
  jurisdictionId: number | null = null,
): Promise<Building[]> {
  const jid = scopedTo(role, jurisdictionId);
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase.from("buildings").select("*, jurisdictions(name)");
    if (jid != null) q = q.eq("jurisdiction_id", jid);
    return q.order("name").range(from, to);
  });
  return rows.map(mapBuilding);
}

export async function saveBuilding(values: BuildingFormValues, id?: string): Promise<void> {
  const { error } = id
    ? await supabase.from("buildings").update(values).eq("id", id)
    : await supabase.from("buildings").insert(values);
  if (error) {
    throw new Error(error.code === "23505" ? "A building with this code already exists." : errorMessage(error));
  }
}

export async function deleteBuilding(id: string): Promise<void> {
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503" ? "This building still has meters. Move or delete them first." : errorMessage(error),
    );
  }
}

// ---------------------------------------------------------------------------
// Meters and readings
// ---------------------------------------------------------------------------

const mapMeter = (r: Row): Meter => {
  const latest = (r.meter_readings ?? [])[0] ?? null;
  return {
    id: r.id,
    meterNumber: r.meter_number,
    buildingId: r.building_id,
    buildingName: r.buildings?.name ?? null,
    buildingCode: r.buildings?.code ?? null,
    jurisdictionId: r.jurisdiction_id,
    utility: r.utility,
    kind: r.kind,
    ecgAccountNumber: r.ecg_account_number ?? null,
    multiplier: Number(r.multiplier ?? 1),
    installedOn: r.installed_on ?? null,
    isActive: r.is_active ?? true,
    notes: r.notes ?? null,
    lastReadingKwh: latest ? Number(latest.reading_kwh) : null,
    lastReadingAt: latest?.reading_at ?? null,
  };
};

export async function fetchMeters(
  role: UserRole | null = null,
  jurisdictionId: number | null = null,
): Promise<Meter[]> {
  const jid = scopedTo(role, jurisdictionId);
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase
      .from("meters")
      .select("*, buildings(name, code), meter_readings(reading_kwh, reading_at)")
      .order("reading_at", { referencedTable: "meter_readings", ascending: false })
      .limit(1, { referencedTable: "meter_readings" });
    if (jid != null) q = q.eq("jurisdiction_id", jid);
    return q.order("meter_number").range(from, to);
  });
  return rows.map(mapMeter);
}

export async function saveMeter(values: MeterFormValues, id?: string): Promise<void> {
  const { error } = id
    ? await supabase.from("meters").update(values).eq("id", id)
    : await supabase.from("meters").insert(values);
  if (error) {
    throw new Error(error.code === "23505" ? "A meter with this number already exists." : errorMessage(error));
  }
}

export async function setMeterActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("meters").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

export async function fetchReadings(meterId: string): Promise<MeterReading[]> {
  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from("meter_readings")
      .select("*, recorded_by_user:users!recorded_by(full_name)")
      .eq("meter_id", meterId)
      .order("reading_at", { ascending: false })
      .range(from, to),
  );
  return rows.map((r) => ({
    id: r.id,
    meterId: r.meter_id,
    readingAt: r.reading_at,
    readingKwh: Number(r.reading_kwh),
    source: r.source,
    notes: r.notes ?? null,
    recordedByName: r.recorded_by_user?.full_name ?? null,
  }));
}

export async function addReading(meterId: string, values: ReadingFormValues): Promise<void> {
  const { error } = await supabase.from("meter_readings").insert({
    meter_id: meterId,
    reading_at: new Date(values.reading_at).toISOString(),
    reading_kwh: values.reading_kwh,
    notes: values.notes,
  });
  if (error) {
    throw new Error(error.code === "23505" ? "There is already a reading at this exact time." : errorMessage(error));
  }
}

export interface ReadingImportRow {
  meterId: string;
  readingAt: string;
  readingKwh: number;
  notes: string | null;
}

export async function importReadings(rows: ReadingImportRow[]): Promise<number> {
  const { error, count } = await supabase.from("meter_readings").insert(
    rows.map((r) => ({
      meter_id: r.meterId,
      reading_at: r.readingAt,
      reading_kwh: r.readingKwh,
      notes: r.notes,
      source: "import",
    })),
    { count: "exact" },
  );
  if (error) throw new Error(errorMessage(error, "Could not import the readings."));
  return count ?? rows.length;
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from("meter_readings").delete().eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

const mapBill = (r: Row): Bill => ({
  id: r.id,
  meterId: r.meter_id ?? null,
  meterNumber: r.meters?.meter_number ?? null,
  buildingId: r.building_id ?? null,
  buildingName: r.buildings?.name ?? null,
  jurisdictionId: r.jurisdiction_id,
  accountNumber: r.account_number ?? null,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  consumptionKwh: r.consumption_kwh != null ? Number(r.consumption_kwh) : null,
  maxDemandKva: r.max_demand_kva != null ? Number(r.max_demand_kva) : null,
  amountGhs: Number(r.amount_ghs),
  dueDate: r.due_date ?? null,
  paidAt: r.paid_at ?? null,
  notes: r.notes ?? null,
});

export async function fetchBills(role: UserRole | null = null, jurisdictionId: number | null = null): Promise<Bill[]> {
  const jid = scopedTo(role, jurisdictionId);
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase.from("bills").select("*, meters(meter_number), buildings(name)");
    if (jid != null) q = q.eq("jurisdiction_id", jid);
    return q.order("period_end", { ascending: false }).order("id").range(from, to);
  });
  return rows.map(mapBill);
}

export async function saveBill(values: BillFormValues, id?: string): Promise<void> {
  // building_id and jurisdiction_id are filled from the meter by the
  // bills_fill_from_meter trigger (BEFORE INSERT, so NOT NULL still holds).
  const { error } = id
    ? await supabase.from("bills").update(values).eq("id", id)
    : await supabase.from("bills").insert(values);
  if (error) throw new Error(errorMessage(error, "Could not save the bill."));
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

// ---------------------------------------------------------------------------
// Outages
// ---------------------------------------------------------------------------

const mapOutage = (r: Row): Outage => ({
  id: r.id,
  jurisdictionId: r.jurisdiction_id,
  jurisdictionName: r.jurisdictions?.name ?? null,
  buildingId: r.building_id ?? null,
  buildingName: r.buildings?.name ?? null,
  startedAt: r.started_at,
  endedAt: r.ended_at ?? null,
  cause: r.cause,
  generatorUsed: r.generator_used ?? false,
  generatorHours: r.generator_hours != null ? Number(r.generator_hours) : null,
  description: r.description ?? null,
  durationHours: durationHours(r.started_at, r.ended_at ?? null),
});

export async function fetchOutages(
  role: UserRole | null = null,
  jurisdictionId: number | null = null,
): Promise<Outage[]> {
  const jid = scopedTo(role, jurisdictionId);
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase.from("outages").select("*, jurisdictions(name), buildings(name)");
    if (jid != null) q = q.eq("jurisdiction_id", jid);
    return q.order("started_at", { ascending: false }).order("id").range(from, to);
  });
  return rows.map(mapOutage);
}

const toIso = (local: string | null) => (local ? new Date(local).toISOString() : null);

export async function saveOutage(values: OutageFormValues, id?: string): Promise<void> {
  const payload = { ...values, started_at: toIso(values.started_at), ended_at: toIso(values.ended_at) };
  const { error } = id
    ? await supabase.from("outages").update(payload).eq("id", id)
    : await supabase.from("outages").insert(payload);
  if (error) throw new Error(errorMessage(error, "Could not save the outage."));
}

export async function endOutageNow(id: string): Promise<void> {
  const { error } = await supabase.from("outages").update({ ended_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

export async function deleteOutage(id: string): Promise<void> {
  const { error } = await supabase.from("outages").delete().eq("id", id);
  if (error) throw new Error(errorMessage(error));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface MonthlyEnergyRow {
  buildingId: string;
  jurisdictionId: number;
  utility: string;
  month: string;
  consumptionKwh: number;
}

export interface MonthlyCostRow {
  buildingId: string | null;
  jurisdictionId: number;
  month: string;
  amountGhs: number;
  billedKwh: number;
}

export async function fetchMonthlyEnergy(
  sinceMonth: string,
  jurisdictionId: number | null,
): Promise<MonthlyEnergyRow[]> {
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase.from("building_monthly_energy").select("*").gte("month", sinceMonth);
    if (jurisdictionId != null) q = q.eq("jurisdiction_id", jurisdictionId);
    return q.order("month").range(from, to);
  });
  return rows.map((r) => ({
    buildingId: r.building_id,
    jurisdictionId: r.jurisdiction_id,
    utility: r.utility,
    month: r.month,
    consumptionKwh: Number(r.consumption_kwh ?? 0),
  }));
}

export async function fetchMonthlyCost(sinceMonth: string, jurisdictionId: number | null): Promise<MonthlyCostRow[]> {
  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase.from("building_monthly_cost").select("*").gte("month", sinceMonth);
    if (jurisdictionId != null) q = q.eq("jurisdiction_id", jurisdictionId);
    return q.order("month").range(from, to);
  });
  return rows.map((r) => ({
    buildingId: r.building_id ?? null,
    jurisdictionId: r.jurisdiction_id,
    month: r.month,
    amountGhs: Number(r.amount_ghs ?? 0),
    billedKwh: Number(r.billed_kwh ?? 0),
  }));
}

export { scopedTo };
