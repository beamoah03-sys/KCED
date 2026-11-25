import { errorMessage, fetchAllRows, supabase } from "@/lib/supabase";
import type { Asset } from "@/features/asset/schema";
import type { UserRole } from "@/features/profile/services/profile.service";

const TABLE = "assets";
const SELECT = "*, jurisdictions(name, code)";

/**
 * Asset queries. Throws on failure so callers can catch → error state.
 */

/** Map a raw `assets` row (with joined jurisdiction) to an `Asset`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAsset(row: Record<string, any>): Asset {
  const jurisdiction = row.jurisdictions ?? null;
  return {
    id: row.id,
    assetCode: row.asset_code ?? "",
    assetType: row.asset_type,
    jurisdictionId: row.jurisdiction_id ?? null,
    buildingId: row.building_id ?? null,
    location: row.location ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    manufacturer: row.manufacturer ?? null,
    serialNumber: row.serial_number ?? null,
    nameplatePhotoUrl: row.nameplate_photo_url ?? null,
    installationDate: row.installation_date ?? null,
    condition: row.condition ?? null,
    operationalStatus: row.operational_status ?? null,
    observedIssues: row.observed_issues ?? null,
    lastMaintenance: row.last_maintenance ?? null,
    nextMaintenance: row.next_maintenance ?? null,
    specifications: row.specifications ?? {},
    retiredAt: row.retired_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    jurisdictionName: jurisdiction?.name ?? null,
    jurisdictionCode: jurisdiction?.code ?? null,
  };
}

/** Load assets, newest first, with their jurisdiction name/code.
 *  Admins see all; managers/technicians see only their jurisdiction (RLS
 *  enforces the same rule on the server). Retired assets are hidden unless
 *  `includeRetired` is set. Pages through all rows (no 1,000-row cap). */
export async function fetchAssets(
  role?: UserRole | null,
  jurisdictionId?: number | null,
  { includeRetired = false }: { includeRetired?: boolean } = {},
): Promise<Asset[]> {
  const scoped = role && role !== "admin" && jurisdictionId != null;
  const rows = await fetchAllRows((from, to) => {
    let query = supabase.from(TABLE).select(SELECT);
    if (scoped) query = query.eq("jurisdiction_id", jurisdictionId!);
    if (!includeRetired) query = query.is("retired_at", null);
    return query.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  return rows.map(mapAsset);
}

export type AssetInput = Pick<Asset, "assetCode" | "assetType" | "jurisdictionId"> &
  Partial<
    Pick<
      Asset,
      | "buildingId"
      | "location"
      | "manufacturer"
      | "serialNumber"
      | "installationDate"
      | "condition"
      | "operationalStatus"
      | "observedIssues"
      | "lastMaintenance"
      | "nextMaintenance"
      | "specifications"
    >
  >;

/** Convert an `AssetInput` to a database row (only set fields). */
export function assetInputToRow(asset: AssetInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    asset_code: asset.assetCode.trim().toUpperCase(),
    asset_type: asset.assetType,
    jurisdiction_id: asset.jurisdictionId,
  };
  if (asset.buildingId) payload.building_id = asset.buildingId;
  if (asset.location) payload.location = asset.location;
  if (asset.manufacturer) payload.manufacturer = asset.manufacturer;
  if (asset.serialNumber) payload.serial_number = asset.serialNumber;
  if (asset.installationDate) payload.installation_date = asset.installationDate;
  if (asset.condition) payload.condition = asset.condition;
  if (asset.operationalStatus) payload.operational_status = asset.operationalStatus;
  if (asset.observedIssues) payload.observed_issues = asset.observedIssues;
  if (asset.lastMaintenance) payload.last_maintenance = asset.lastMaintenance;
  if (asset.nextMaintenance) payload.next_maintenance = asset.nextMaintenance;
  if (asset.specifications && Object.keys(asset.specifications).length > 0) {
    payload.specifications = asset.specifications;
  }
  return payload;
}

/** Create a new asset. Returns the created asset. */
export async function createAsset(asset: AssetInput): Promise<Asset> {
  const { data, error } = await supabase.from(TABLE).insert(assetInputToRow(asset)).select(SELECT).single();
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "An asset with this code already exists."
        : errorMessage(error, "Could not create the asset."),
    );
  }
  return mapAsset(data);
}

/** Insert many assets at once (CSV import). Returns how many were created. */
export async function importAssets(assets: AssetInput[]): Promise<number> {
  if (assets.length === 0) return 0;
  const { error, count } = await supabase.from(TABLE).insert(assets.map(assetInputToRow), { count: "exact" });
  if (error) throw new Error(errorMessage(error, "Could not import the assets."));
  return count ?? assets.length;
}

/** Update an asset's editable fields. */
export async function updateAsset(
  id: string,
  updates: {
    manufacturer?: string | null;
    serialNumber?: string | null;
    location?: string | null;
    buildingId?: string | null;
    installationDate?: string | null;
    condition?: Asset["condition"];
    operationalStatus?: Asset["operationalStatus"];
    observedIssues?: string | null;
    lastMaintenance?: string | null;
    nextMaintenance?: string | null;
    specifications?: Record<string, unknown>;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.manufacturer !== undefined) payload.manufacturer = updates.manufacturer || null;
  if (updates.serialNumber !== undefined) payload.serial_number = updates.serialNumber || null;
  if (updates.location !== undefined) {
    payload.location = updates.location || null;
    // Let the database re-derive coordinates from the new location text.
    payload.latitude = null;
    payload.longitude = null;
  }
  if (updates.buildingId !== undefined) payload.building_id = updates.buildingId || null;
  if (updates.installationDate !== undefined) payload.installation_date = updates.installationDate || null;
  if (updates.condition !== undefined) payload.condition = updates.condition;
  if (updates.operationalStatus !== undefined) payload.operational_status = updates.operationalStatus;
  if (updates.observedIssues !== undefined) payload.observed_issues = updates.observedIssues || null;
  if (updates.lastMaintenance !== undefined) payload.last_maintenance = updates.lastMaintenance || null;
  if (updates.nextMaintenance !== undefined) payload.next_maintenance = updates.nextMaintenance || null;
  if (updates.specifications !== undefined) payload.specifications = updates.specifications;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from(TABLE).update(payload).eq("id", id);
  if (error) throw new Error(errorMessage(error, "Could not update asset. Please try again."));
}

/** Retire (decommission) or reinstate an asset. Admins and managers only. */
export async function setAssetRetired(id: string, retired: boolean): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ retired_at: retired ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(errorMessage(error, "Could not update the asset."));
}

/** Fetch a single asset by ID. Returns null when not found. */
export async function fetchAssetById(id: string): Promise<Asset | null> {
  const { data, error } = await supabase.from(TABLE).select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapAsset(data) : null;
}
