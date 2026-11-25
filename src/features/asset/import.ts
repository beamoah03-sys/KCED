import type { ImportValidation } from "@/components/CsvImportDialog";
import {
  ASSET_CONDITIONS,
  ASSET_TYPES,
  OPERATIONAL_STATUSES,
  type AssetCondition,
  type AssetType,
  type OperationalStatus,
} from "@/features/asset/schema";
import { ASSET_SPEC_FIELDS } from "@/features/asset/asset-specs-config";
import type { AssetInput } from "@/features/asset/services/asset.service";
import type { Jurisdiction } from "@/features/service_request/schema";

export const ASSET_TEMPLATE_COLUMNS = [
  "asset_code",
  "asset_type",
  "jurisdiction_code",
  "location",
  "manufacturer",
  "serial_number",
  "installation_date",
  "condition",
  "operational_status",
  "last_maintenance",
  "next_maintenance",
];

export const ASSET_TEMPLATE_EXAMPLE = [
  "KNUST-COE-GEN-001",
  "generator",
  "COE",
  "6.6750, -1.5672",
  "Perkins",
  "PK-123456",
  "2019-03-15",
  "good",
  "working",
  "2026-09-01",
  "2026-12-01",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;

const lookup = <T extends string>(list: readonly { dbValue: T; label: string }[], raw: string): T | null => {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return list.find((x) => x.dbValue === v || x.label.toLowerCase().replace(/\s+/g, "_") === v)?.dbValue ?? null;
};

/**
 * Validate CSV rows for an asset import. Extra columns named like a spec
 * field of the asset's type (e.g. `rated_power_kva`) go into `specifications`.
 * Admins may import into any jurisdiction; managers only into their own.
 */
export function validateAssetRows(
  rows: Record<string, string>[],
  jurisdictions: Jurisdiction[],
  allowedJurisdictionId: number | null,
): ImportValidation<AssetInput> {
  const valid: AssetInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const byCode = new Map(jurisdictions.map((j) => [j.code.toUpperCase(), j]));

  rows.forEach((row, i) => {
    const line = `Row ${i + 2}`; // +1 header, +1 human counting
    const problems: string[] = [];

    const code = (row.asset_code ?? "").toUpperCase();
    if (!CODE_RE.test(code)) problems.push("asset_code must be 2-40 letters, digits or dashes");
    else if (seen.has(code)) problems.push(`duplicate asset_code ${code} in this file`);
    seen.add(code);

    const type = lookup(ASSET_TYPES, row.asset_type ?? "") as AssetType | null;
    if (!type) problems.push(`unknown asset_type '${row.asset_type ?? ""}'`);

    const j = byCode.get((row.jurisdiction_code ?? "").toUpperCase());
    if (!j) problems.push(`unknown jurisdiction_code '${row.jurisdiction_code ?? ""}'`);
    else if (allowedJurisdictionId !== null && j.id !== allowedJurisdictionId)
      problems.push("you can only import into your own jurisdiction");

    const condition = row.condition ? (lookup(ASSET_CONDITIONS, row.condition) as AssetCondition | null) : null;
    if (row.condition && !condition) problems.push(`unknown condition '${row.condition}'`);

    const status = row.operational_status
      ? (lookup(OPERATIONAL_STATUSES, row.operational_status) as OperationalStatus | null)
      : null;
    if (row.operational_status && !status) problems.push(`unknown operational_status '${row.operational_status}'`);

    for (const key of ["installation_date", "last_maintenance", "next_maintenance"]) {
      if (row[key] && !DATE_RE.test(row[key])) problems.push(`${key} must be YYYY-MM-DD`);
    }

    if (problems.length > 0 || !type || !j) {
      errors.push(`${line}: ${problems.join("; ")}`);
      return;
    }

    const specifications: Record<string, unknown> = {};
    for (const field of ASSET_SPEC_FIELDS[type]) {
      const raw = row[field.key];
      if (raw === undefined || raw === "") continue;
      if (field.type === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          errors.push(`${line}: ${field.key} must be a number`);
          return;
        }
        specifications[field.key] = n;
      } else {
        specifications[field.key] = raw;
      }
    }

    valid.push({
      assetCode: code,
      assetType: type,
      jurisdictionId: j.id,
      location: row.location || null,
      manufacturer: row.manufacturer || null,
      serialNumber: row.serial_number || null,
      installationDate: row.installation_date || null,
      condition,
      operationalStatus: status,
      lastMaintenance: row.last_maintenance || null,
      nextMaintenance: row.next_maintenance || null,
      specifications,
    });
  });

  return { valid, errors };
}
