import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CloudOff, Filter, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetCreateDialog } from "@/features/asset/components/AssetCreateDialog";
import { AssetDetailDialog } from "@/features/asset/components/AssetDetailDialog";
import { AssetFormDialog } from "@/features/asset/components/AssetFormDialog";
import { AssetsTable } from "@/features/asset/components/AssetsTable";
import { useAssets } from "@/features/asset/hooks/useAssets";
import { canCreateAsset, hasOpenAssignment } from "@/features/asset/permissions";
import { useAuth } from "@/lib/auth-context";
import {
  ASSET_TYPES,
  OPERATIONAL_STATUSES,
  type Asset,
  type AssetType,
  type OperationalStatus,
} from "@/features/asset/schema";
import type { Jurisdiction } from "@/features/service_request/schema";
import { fetchJurisdictions } from "@/features/service_request/services/service_request.service";
import { importAssets } from "@/features/asset/services/asset.service";
import { ASSET_TEMPLATE_COLUMNS, ASSET_TEMPLATE_EXAMPLE, validateAssetRows } from "@/features/asset/import";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { ExportButton } from "@/components/ExportButton";
import type { CsvColumn } from "@/lib/csv";

const EXPORT_COLUMNS: CsvColumn<Asset>[] = [
  { header: "asset_code", value: (a) => a.assetCode },
  { header: "asset_type", value: (a) => a.assetType },
  { header: "jurisdiction_code", value: (a) => a.jurisdictionCode },
  { header: "location", value: (a) => a.location },
  { header: "latitude", value: (a) => a.latitude },
  { header: "longitude", value: (a) => a.longitude },
  { header: "manufacturer", value: (a) => a.manufacturer },
  { header: "serial_number", value: (a) => a.serialNumber },
  { header: "installation_date", value: (a) => a.installationDate },
  { header: "condition", value: (a) => a.condition },
  { header: "operational_status", value: (a) => a.operationalStatus },
  { header: "last_maintenance", value: (a) => a.lastMaintenance },
  { header: "next_maintenance", value: (a) => a.nextMaintenance },
  { header: "specifications", value: (a) => JSON.stringify(a.specifications) },
  { header: "retired_at", value: (a) => a.retiredAt },
];

// The `/dashboard` layout route (route.tsx) supplies the sidebar shell and the
// requireAuth guard; this is the assets page: list, filters, create, edit,
// retire, CSV import/export, and a detail sheet whose specifications section
// is driven by ASSET_SPEC_FIELDS.
export const Route = createFileRoute("/dashboard/assets")({
  component: Assets,
});

type TypeFilter = AssetType | "all";
type StatusFilter = OperationalStatus | "all";

function Assets() {
  const [showRetired, setShowRetired] = useState(false);
  const { assets, loading, error, reload } = useAssets({ includeRetired: showRetired });
  const { role, profile, jurisdictionId } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);

  useEffect(() => {
    fetchJurisdictions()
      .then(setJurisdictions)
      .catch(() => {});
  }, []);

  const [detailOpen, setDetailOpen] = useState(false);
  const [viewing, setViewing] = useState<Asset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = assets;

    if (typeFilter !== "all") {
      result = result.filter((a) => a.assetType === typeFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.operationalStatus === statusFilter);
    }
    if (jurisdictionFilter !== "all") {
      result = result.filter((a) => a.jurisdictionId === jurisdictionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.assetCode.toLowerCase().includes(q) ||
          (a.location ?? "").toLowerCase().includes(q) ||
          (a.manufacturer ?? "").toLowerCase().includes(q) ||
          (a.serialNumber ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [assets, typeFilter, statusFilter, jurisdictionFilter, searchQuery]);

  const openView = (asset: Asset) => {
    setViewing(asset);
    setDetailOpen(true);
  };

  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const openEdit = async (asset: Asset) => {
    // Technicians need an open work-order assignment on the asset — the
    // detail dialog hides Edit otherwise; re-check here as defense in depth.
    if (role === "technician") {
      try {
        const allowed = profile !== null && (await hasOpenAssignment(asset.id, profile.id));
        if (!allowed) return;
      } catch {
        return;
      }
    }
    setDetailOpen(false);
    setEditing(asset);
    setFormOpen(true);
  };

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (jurisdictionFilter !== "all" ? 1 : 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Assets</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading assets…" : `View and manage all registered assets across jurisdictions`}
          </p>
        </div>
        {canCreateAsset(role) && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import CSV
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Asset
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <ExportButton name="assets" rows={filtered} columns={EXPORT_COLUMNS} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="size-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Type</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setTypeFilter("all")}>All types</DropdownMenuItem>
                  {ASSET_TYPES.map((t) => (
                    <DropdownMenuItem key={t.dbValue} onSelect={() => setTypeFilter(t.dbValue)}>
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
                  {OPERATIONAL_STATUSES.map((s) => (
                    <DropdownMenuItem key={s.dbValue} onSelect={() => setStatusFilter(s.dbValue)}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Jurisdiction</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  <DropdownMenuItem onSelect={() => setJurisdictionFilter("all")}>All jurisdictions</DropdownMenuItem>
                  {jurisdictions.map((j) => (
                    <DropdownMenuItem key={j.id} onSelect={() => setJurisdictionFilter(j.id)}>
                      {j.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowRetired((v) => !v)}>
                {showRetired ? "Hide retired assets" : "Show retired assets"}
              </DropdownMenuItem>
              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setJurisdictionFilter("all");
                    }}
                  >
                    Clear all filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <CloudOff className="size-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">Something went wrong</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          <Button onClick={reload} className="mt-2">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Boxes className="size-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">{assets.length === 0 ? "No assets yet." : "No matching assets."}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {assets.length === 0
              ? "Tracked assets will appear here."
              : "No assets match these filters. Try different ones."}
          </p>
        </div>
      ) : (
        <AssetsTable assets={filtered} onView={openView} />
      )}

      <AssetDetailDialog
        asset={viewing}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onChanged={reload}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import assets"
        description={
          <>
            <p>One row per asset. Required: asset_code, asset_type, jurisdiction_code.</p>
            <p>
              asset_type is one of: generator, transformer, lift, solar_pv, streetlight, air_conditioner. Extra columns
              named after a specification (for example rated_power_kva) are saved as specifications.
            </p>
          </>
        }
        templateName="asset-import-template"
        templateColumns={ASSET_TEMPLATE_COLUMNS}
        templateExample={ASSET_TEMPLATE_EXAMPLE}
        validate={(rows) => validateAssetRows(rows, jurisdictions, role === "admin" ? null : jurisdictionId)}
        onImport={importAssets}
        onDone={reload}
      />
      <AssetFormDialog asset={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />
      <AssetCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={reload} />
    </div>
  );
}
