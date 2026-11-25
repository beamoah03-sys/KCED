import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ExportButton";
import { DataTable, ListState, PageHeader, SearchBox, type Column } from "@/components/page";
import { useScopedData } from "@/hooks/use-scoped-data";
import { useAuth } from "@/lib/auth-context";
import type { CsvColumn } from "@/lib/csv";
import { BUILDING_CATEGORIES, labelOf, type Building } from "@/features/energy/schema";
import { deleteBuilding, fetchBuildings } from "@/features/energy/services/energy.service";
import { BuildingFormDialog } from "@/features/energy/components/BuildingFormDialog";

export const Route = createFileRoute("/dashboard/buildings")({
  component: Buildings,
});

const EMPTY: Building[] = [];

const EXPORT_COLUMNS: CsvColumn<Building>[] = [
  { header: "code", value: (b) => b.code },
  { header: "name", value: (b) => b.name },
  { header: "category", value: (b) => b.category },
  { header: "jurisdiction", value: (b) => b.jurisdictionName },
  { header: "floor_area_m2", value: (b) => b.floorAreaM2 },
  { header: "occupants", value: (b) => b.occupants },
  { header: "latitude", value: (b) => b.latitude },
  { header: "longitude", value: (b) => b.longitude },
];

function Buildings() {
  const { role, jurisdictionId } = useAuth();
  const {
    data: buildings,
    loading,
    error,
    reload,
  } = useScopedData(fetchBuildings, EMPTY, "Could not load buildings. Check your connection and try again.");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Building | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canManage = (b?: Building) =>
    role === "admin" || (role === "manager" && (!b || b.jurisdictionId === jurisdictionId));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.jurisdictionName ?? "").toLowerCase().includes(q),
    );
  }, [buildings, search]);

  const remove = async (b: Building) => {
    if (!window.confirm(`Delete ${b.name}? This cannot be undone.`)) return;
    try {
      await deleteBuilding(b.id);
      toast.success("Building deleted.");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: Column<Building>[] = [
    { header: "Code", cell: (b) => <span className="font-medium tabular-nums">{b.code}</span> },
    { header: "Name", cell: (b) => b.name },
    { header: "Category", cell: (b) => labelOf(BUILDING_CATEGORIES, b.category) },
    { header: "Jurisdiction", cell: (b) => <span className="text-muted-foreground">{b.jurisdictionName ?? "—"}</span> },
    { header: "Floor area (m²)", numeric: true, cell: (b) => b.floorAreaM2?.toLocaleString() ?? "—" },
    { header: "Occupants", numeric: true, cell: (b) => b.occupants?.toLocaleString() ?? "—" },
    {
      header: " ",
      className: "w-24",
      cell: (b) =>
        canManage(b) ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                setEditing(b);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4 text-muted-foreground" />
              <span className="sr-only">Edit {b.name}</span>
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(b)}>
              <Trash2 className="size-4 text-muted-foreground" />
              <span className="sr-only">Delete {b.name}</span>
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Buildings"
        subtitle="Campus buildings that meters, assets and outages belong to"
        actions={
          canManage() && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Add building
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search buildings..." />
        <ExportButton name="buildings" rows={filtered} columns={EXPORT_COLUMNS} />
      </div>
      <ListState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        onRetry={reload}
        emptyIcon={Building2}
        emptyTitle={buildings.length === 0 ? "No buildings yet." : "No matching buildings."}
        emptyText={
          buildings.length === 0
            ? "Add the buildings you meter, starting with the largest users."
            : "Try a different search."
        }
      >
        <DataTable rows={filtered} columns={columns} rowKey={(b) => b.id} />
      </ListState>
      <BuildingFormDialog building={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />
    </div>
  );
}
