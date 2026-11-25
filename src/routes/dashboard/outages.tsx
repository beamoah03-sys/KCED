import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Power, ZapOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ExportButton";
import { DataTable, ListState, PageHeader, StatTile, formatDateTime, type Column } from "@/components/page";
import { useScopedData } from "@/hooks/use-scoped-data";
import { useAuth } from "@/lib/auth-context";
import type { CsvColumn } from "@/lib/csv";
import { OUTAGE_CAUSES, labelOf, type Building, type Outage } from "@/features/energy/schema";
import { endOutageNow, fetchBuildings, fetchOutages } from "@/features/energy/services/energy.service";
import { OutageFormDialog } from "@/features/energy/components/OutageFormDialog";

export const Route = createFileRoute("/dashboard/outages")({
  component: Outages,
});

const NO_OUTAGES: Outage[] = [];
const NO_BUILDINGS: Building[] = [];

const EXPORT_COLUMNS: CsvColumn<Outage>[] = [
  { header: "jurisdiction", value: (o) => o.jurisdictionName },
  { header: "building", value: (o) => o.buildingName },
  { header: "started_at", value: (o) => o.startedAt },
  { header: "ended_at", value: (o) => o.endedAt },
  { header: "duration_hours", value: (o) => o.durationHours },
  { header: "cause", value: (o) => o.cause },
  { header: "generator_used", value: (o) => o.generatorUsed },
  { header: "generator_hours", value: (o) => o.generatorHours },
  { header: "description", value: (o) => o.description },
];

function Outages() {
  const { role, jurisdictionId } = useAuth();
  const { data: outages, loading, error, reload } = useScopedData(fetchOutages, NO_OUTAGES, "Could not load outages.");
  const { data: buildings } = useScopedData(fetchBuildings, NO_BUILDINGS, "Could not load buildings.");
  const [editing, setEditing] = useState<Outage | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canWrite = (o: Outage) => role === "admin" || o.jurisdictionId === jurisdictionId;

  const stats = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000;
    const recent = outages.filter((o) => new Date(o.startedAt).getTime() >= since);
    return {
      ongoing: outages.filter((o) => !o.endedAt).length,
      count30: recent.length,
      hours30: recent.reduce((s, o) => s + o.durationHours, 0),
      genHours30: recent.reduce((s, o) => s + (o.generatorHours ?? 0), 0),
    };
  }, [outages]);

  const endNow = async (o: Outage) => {
    try {
      await endOutageNow(o.id);
      toast.success("Outage closed.");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: Column<Outage>[] = [
    {
      header: "Started",
      cell: (o) => (
        <div>
          <p className="font-medium">{formatDateTime(o.startedAt)}</p>
          {!o.endedAt && <p className="text-xs font-medium text-error">Ongoing</p>}
        </div>
      ),
    },
    { header: "Area", cell: (o) => o.buildingName ?? o.jurisdictionName ?? "—" },
    { header: "Cause", cell: (o) => labelOf(OUTAGE_CAUSES, o.cause) },
    { header: "Duration (h)", numeric: true, cell: (o) => o.durationHours.toFixed(1) },
    {
      header: "Generator (h)",
      numeric: true,
      cell: (o) => (o.generatorUsed ? (o.generatorHours?.toFixed(1) ?? "Yes") : "—"),
    },
    {
      header: " ",
      className: "w-36",
      cell: (o) =>
        canWrite(o) ? (
          <div className="flex justify-end gap-1">
            {!o.endedAt && (
              <Button variant="outline" size="sm" onClick={() => endNow(o)}>
                <Power className="size-3.5" /> Power back
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                setEditing(o);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4 text-muted-foreground" />
              <span className="sr-only">Edit outage</span>
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Power outages"
        subtitle="Supply interruptions and generator use, to measure reliability and fuel cost"
        actions={
          role && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Log outage
            </Button>
          )
        }
      />
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Ongoing now" value={String(stats.ongoing)} tone={stats.ongoing > 0 ? "warning" : "default"} />
        <StatTile label="Outages, last 30 days" value={String(stats.count30)} />
        <StatTile label="Hours without grid, last 30 days" value={stats.hours30.toFixed(1)} />
        <StatTile label="Generator hours, last 30 days" value={stats.genHours30.toFixed(1)} />
      </div>
      <div className="flex justify-end">
        <ExportButton name="outages" rows={outages} columns={EXPORT_COLUMNS} />
      </div>
      <ListState
        loading={loading}
        error={error}
        empty={outages.length === 0}
        onRetry={reload}
        emptyIcon={ZapOff}
        emptyTitle="No outages logged."
        emptyText="Log each power cut with its start and end time to track supply reliability."
      >
        <DataTable rows={outages} columns={columns} rowKey={(o) => o.id} />
      </ListState>
      <OutageFormDialog
        outage={editing}
        buildings={buildings}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />
    </div>
  );
}
