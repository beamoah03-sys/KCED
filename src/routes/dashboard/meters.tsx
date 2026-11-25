import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge, Pencil, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { ExportButton } from "@/components/ExportButton";
import { DataTable, ListState, PageHeader, SearchBox, formatDateTime, type Column } from "@/components/page";
import { useScopedData } from "@/hooks/use-scoped-data";
import { useAuth } from "@/lib/auth-context";
import type { CsvColumn } from "@/lib/csv";
import { METER_KINDS, METER_UTILITIES, labelOf, type Building, type Meter } from "@/features/energy/schema";
import { fetchBuildings, fetchMeters, importReadings } from "@/features/energy/services/energy.service";
import { validateReadingRows } from "@/features/energy/import";
import { MeterFormDialog } from "@/features/energy/components/MeterFormDialog";
import { MeterReadingsSheet } from "@/features/energy/components/MeterReadingsSheet";

export const Route = createFileRoute("/dashboard/meters")({
  component: Meters,
});

const NO_METERS: Meter[] = [];
const NO_BUILDINGS: Building[] = [];

const EXPORT_COLUMNS: CsvColumn<Meter>[] = [
  { header: "meter_number", value: (m) => m.meterNumber },
  { header: "building", value: (m) => m.buildingName },
  { header: "supply", value: (m) => m.utility },
  { header: "type", value: (m) => m.kind },
  { header: "ecg_account_number", value: (m) => m.ecgAccountNumber },
  { header: "multiplier", value: (m) => m.multiplier },
  { header: "last_reading_kwh", value: (m) => m.lastReadingKwh },
  { header: "last_reading_at", value: (m) => m.lastReadingAt },
  { header: "active", value: (m) => m.isActive },
];

function Meters() {
  const { role, jurisdictionId } = useAuth();
  const {
    data: meters,
    loading,
    error,
    reload,
  } = useScopedData(fetchMeters, NO_METERS, "Could not load meters. Check your connection and try again.");
  const { data: buildings } = useScopedData(fetchBuildings, NO_BUILDINGS, "Could not load buildings.");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Meter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Meter | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const isManager = role === "admin" || role === "manager";
  const manageable = (m: Meter) => role === "admin" || (role === "manager" && m.jurisdictionId === jurisdictionId);
  const canRecord = (m: Meter) => role === "admin" || (role !== null && m.jurisdictionId === jurisdictionId);
  const myBuildings = buildings.filter((b) => role === "admin" || b.jurisdictionId === jurisdictionId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meters;
    return meters.filter(
      (m) =>
        m.meterNumber.toLowerCase().includes(q) ||
        (m.buildingName ?? "").toLowerCase().includes(q) ||
        (m.ecgAccountNumber ?? "").toLowerCase().includes(q),
    );
  }, [meters, search]);

  const columns: Column<Meter>[] = [
    {
      header: "Meter",
      cell: (m) => (
        <div>
          <p className="font-medium tabular-nums">{m.meterNumber}</p>
          {!m.isActive && <p className="text-xs text-muted-foreground">Inactive</p>}
        </div>
      ),
    },
    { header: "Building", cell: (m) => m.buildingName ?? "—" },
    { header: "Supply", cell: (m) => labelOf(METER_UTILITIES, m.utility) },
    { header: "Type", cell: (m) => labelOf(METER_KINDS, m.kind) },
    { header: "Last reading (kWh)", numeric: true, cell: (m) => m.lastReadingKwh?.toLocaleString() ?? "—" },
    {
      header: "Read on",
      cell: (m) => {
        const stale = m.lastReadingAt && Date.now() - new Date(m.lastReadingAt).getTime() > 35 * 86_400_000;
        return (
          <span
            className={stale ? "text-error" : "text-muted-foreground"}
            title={stale ? "Not read for over a month" : undefined}
          >
            {formatDateTime(m.lastReadingAt)}
          </span>
        );
      },
    },
    {
      header: " ",
      className: "w-12",
      cell: (m) =>
        manageable(m) ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(m);
              setFormOpen(true);
            }}
          >
            <Pencil className="size-4 text-muted-foreground" />
            <span className="sr-only">Edit meter {m.meterNumber}</span>
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Meters"
        subtitle="Electricity meters and their readings. Click a meter to record a reading."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Import readings
            </Button>
            {isManager && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> Add meter
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search meters..." />
        <ExportButton name="meters" rows={filtered} columns={EXPORT_COLUMNS} />
      </div>
      <ListState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        onRetry={reload}
        emptyIcon={Gauge}
        emptyTitle={meters.length === 0 ? "No meters yet." : "No matching meters."}
        emptyText={
          meters.length === 0
            ? "Add buildings first, then register each meter against its building."
            : "Try a different search."
        }
      >
        <DataTable rows={filtered} columns={columns} rowKey={(m) => m.id} onRowClick={setViewing} />
      </ListState>

      <MeterFormDialog
        meter={editing}
        buildings={myBuildings}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />
      <MeterReadingsSheet
        meter={viewing}
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewing(null)}
        canRecord={viewing ? canRecord(viewing) : false}
        canCorrect={viewing ? manageable(viewing) : false}
        onChanged={reload}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import meter readings"
        description={
          <>
            <p>One row per reading: meter_number, reading_at, reading_kwh, and an optional note.</p>
            <p>Use the cumulative register value shown on the meter, not the usage.</p>
          </>
        }
        templateName="meter-readings-template"
        templateColumns={["meter_number", "reading_at", "reading_kwh", "notes"]}
        templateExample={[meters[0]?.meterNumber ?? "ECG-0001", "2026-11-01 08:00", "12345.6", ""]}
        validate={(rows) => validateReadingRows(rows, meters.filter(canRecord))}
        onImport={importReadings}
        onDone={reload}
      />
    </div>
  );
}
