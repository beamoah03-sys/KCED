import { describe, expect, it } from "vitest";
import { validateAssetRows } from "@/features/asset/import";
import { validateReadingRows } from "@/features/energy/import";
import type { Meter } from "@/features/energy/schema";

const jurisdictions = [
  { id: 1, name: "Maintenance Yard", code: "MY" },
  { id: 2, name: "College of Engineering", code: "COE" },
];

describe("validateAssetRows", () => {
  it("accepts a good row and puts spec columns into specifications", () => {
    const { valid, errors } = validateAssetRows(
      [
        {
          asset_code: "knust-coe-gen-001",
          asset_type: "Generator",
          jurisdiction_code: "coe",
          rated_power_kva: "200",
          fuel_tank_capacity_liters: "500",
        },
      ],
      jurisdictions,
      null,
    );
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({
      assetCode: "KNUST-COE-GEN-001",
      assetType: "generator",
      jurisdictionId: 2,
      specifications: { rated_power_kva: "200", fuel_tank_capacity_liters: 500 },
    });
  });

  it("reports every problem with its row number", () => {
    const { valid, errors } = validateAssetRows(
      [
        { asset_code: "A-1", asset_type: "toaster", jurisdiction_code: "XYZ", installation_date: "12/03/2020" },
        { asset_code: "A-2", asset_type: "lift", jurisdiction_code: "MY" },
        { asset_code: "A-2", asset_type: "lift", jurisdiction_code: "MY" },
      ],
      jurisdictions,
      null,
    );
    expect(valid).toHaveLength(1);
    expect(errors[0]).toMatch(/^Row 2: .*asset_type.*jurisdiction_code.*YYYY-MM-DD/);
    expect(errors[1]).toMatch(/^Row 4: duplicate asset_code A-2/);
  });

  it("keeps managers inside their jurisdiction", () => {
    const { errors } = validateAssetRows(
      [{ asset_code: "A-1", asset_type: "lift", jurisdiction_code: "MY" }],
      jurisdictions,
      2,
    );
    expect(errors[0]).toMatch(/own jurisdiction/);
  });
});

describe("validateReadingRows", () => {
  const meters = [{ id: "m1", meterNumber: "ECG-0001" } as Meter];

  it("maps meter numbers to ids", () => {
    const { valid, errors } = validateReadingRows(
      [{ meter_number: "ecg-0001", reading_at: "2026-11-01 08:00", reading_kwh: "1234.5" }],
      meters,
    );
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ meterId: "m1", readingKwh: 1234.5 });
  });

  it("rejects unknown meters, bad dates and negative values", () => {
    const { errors } = validateReadingRows(
      [{ meter_number: "NOPE", reading_at: "yesterday", reading_kwh: "-5" }],
      meters,
    );
    expect(errors[0]).toMatch(/unknown meter_number.*reading_at.*reading_kwh/);
  });
});
