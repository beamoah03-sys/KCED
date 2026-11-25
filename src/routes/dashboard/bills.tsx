import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ExportButton";
import { DataTable, ListState, PageHeader, SearchBox, StatTile, formatDate, type Column } from "@/components/page";
import { useScopedData } from "@/hooks/use-scoped-data";
import { useAuth } from "@/lib/auth-context";
import type { CsvColumn } from "@/lib/csv";
import { formatGhs, formatKwh } from "@/features/energy/calc";
import type { Bill, Meter } from "@/features/energy/schema";
import { deleteBill, fetchBills, fetchMeters } from "@/features/energy/services/energy.service";
import { BillFormDialog } from "@/features/energy/components/BillFormDialog";

export const Route = createFileRoute("/dashboard/bills")({
  component: Bills,
});

const NO_BILLS: Bill[] = [];
const NO_METERS: Meter[] = [];

const EXPORT_COLUMNS: CsvColumn<Bill>[] = [
  { header: "account_number", value: (b) => b.accountNumber },
  { header: "meter_number", value: (b) => b.meterNumber },
  { header: "building", value: (b) => b.buildingName },
  { header: "period_start", value: (b) => b.periodStart },
  { header: "period_end", value: (b) => b.periodEnd },
  { header: "consumption_kwh", value: (b) => b.consumptionKwh },
  { header: "max_demand_kva", value: (b) => b.maxDemandKva },
  { header: "amount_ghs", value: (b) => b.amountGhs },
  { header: "due_date", value: (b) => b.dueDate },
  { header: "paid_at", value: (b) => b.paidAt },
];

function Bills() {
  const { role, jurisdictionId } = useAuth();
  const { data: bills, loading, error, reload } = useScopedData(fetchBills, NO_BILLS, "Could not load bills.");
  const { data: meters } = useScopedData(fetchMeters, NO_METERS, "Could not load meters.");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Bill | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const isManager = role === "admin" || role === "manager";
  const manageable = (b: Bill) => role === "admin" || (role === "manager" && b.jurisdictionId === jurisdictionId);
  const myMeters = meters.filter((m) => role === "admin" || m.jurisdictionId === jurisdictionId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(
      (b) =>
        (b.accountNumber ?? "").toLowerCase().includes(q) ||
        (b.meterNumber ?? "").toLowerCase().includes(q) ||
        (b.buildingName ?? "").toLowerCase().includes(q),
    );
  }, [bills, search]);

  const today = new Date().toISOString().slice(0, 10);
  const unpaid = bills.filter((b) => !b.paidAt);
  const overdue = unpaid.filter((b) => b.dueDate && b.dueDate < today);
  const thisYear = String(new Date().getFullYear());
  const yearTotal = bills.filter((b) => b.periodEnd.startsWith(thisYear)).reduce((s, b) => s + b.amountGhs, 0);

  const remove = async (b: Bill) => {
    if (!window.confirm("Delete this bill?")) return;
    try {
      await deleteBill(b.id);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: Column<Bill>[] = [
    {
      header: "Account / meter",
      cell: (b) => (
        <div>
          <p className="font-medium tabular-nums">{b.accountNumber ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{b.meterNumber ?? "No meter"}</p>
        </div>
      ),
    },
    { header: "Building", cell: (b) => b.buildingName ?? "—" },
    { header: "Period", cell: (b) => `${formatDate(b.periodStart)} – ${formatDate(b.periodEnd)}` },
    { header: "kWh", numeric: true, cell: (b) => (b.consumptionKwh != null ? b.consumptionKwh.toLocaleString() : "—") },
    { header: "Amount", numeric: true, cell: (b) => <span className="font-medium">{formatGhs(b.amountGhs)}</span> },
    {
      header: "Status",
      cell: (b) =>
        b.paidAt ? (
          <span className="text-primary">Paid {formatDate(b.paidAt)}</span>
        ) : b.dueDate && b.dueDate < today ? (
          <span className="text-error">Overdue since {formatDate(b.dueDate)}</span>
        ) : (
          <span className="text-muted-foreground">Due {formatDate(b.dueDate)}</span>
        ),
    },
    {
      header: " ",
      className: "w-24",
      cell: (b) =>
        manageable(b) ? (
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
              <span className="sr-only">Edit bill</span>
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(b)}>
              <Trash2 className="size-4 text-muted-foreground" />
              <span className="sr-only">Delete bill</span>
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Bills"
        subtitle="Utility bills by meter, for cost tracking and bill checking"
        actions={
          isManager && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Record bill
            </Button>
          )
        }
      />
      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label={`Billed in ${thisYear}`} value={formatGhs(yearTotal)} />
        <StatTile
          label="Unpaid bills"
          value={String(unpaid.length)}
          note={formatGhs(unpaid.reduce((s, b) => s + b.amountGhs, 0))}
        />
        <StatTile
          label="Overdue"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "warning" : "default"}
          note={overdue.length > 0 ? formatGhs(overdue.reduce((s, b) => s + b.amountGhs, 0)) : "Nothing overdue"}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by account, meter or building..." />
        <ExportButton name="bills" rows={filtered} columns={EXPORT_COLUMNS} />
      </div>
      <ListState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        onRetry={reload}
        emptyIcon={Receipt}
        emptyTitle={bills.length === 0 ? "No bills yet." : "No matching bills."}
        emptyText={
          bills.length === 0
            ? `Record ECG bills here to track cost. Total kWh billed shows as ${formatKwh(0)} until then.`
            : "Try a different search."
        }
      >
        <DataTable rows={filtered} columns={columns} rowKey={(b) => b.id} />
      </ListState>
      <BillFormDialog bill={editing} meters={myMeters} open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />
    </div>
  );
}
