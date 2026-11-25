import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, PageHeader, StatTile, type Column } from "@/components/page";
import { useScopedData } from "@/hooks/use-scoped-data";
import {
  energyUseIntensity,
  formatGhs,
  formatKwh,
  isUnusualRise,
  lastMonths,
  monthLabel,
  sumByMonth,
} from "@/features/energy/calc";
import type { Building, Outage } from "@/features/energy/schema";
import {
  fetchBuildings,
  fetchMonthlyCost,
  fetchMonthlyEnergy,
  fetchOutages,
  scopedTo,
  type MonthlyCostRow,
  type MonthlyEnergyRow,
} from "@/features/energy/services/energy.service";

export const Route = createFileRoute("/dashboard/energy")({
  component: EnergyOverview,
});

interface OverviewData {
  months: string[];
  energy: MonthlyEnergyRow[];
  cost: MonthlyCostRow[];
  buildings: Building[];
  outages: Outage[];
}

const EMPTY: OverviewData = { months: [], energy: [], cost: [], buildings: [], outages: [] };

async function loadOverview(
  role: Parameters<typeof scopedTo>[0],
  jurisdictionId: number | null,
): Promise<OverviewData> {
  const months = lastMonths(12);
  const jid = scopedTo(role, jurisdictionId);
  const [energy, cost, buildings, outages] = await Promise.all([
    fetchMonthlyEnergy(months[0], jid),
    fetchMonthlyCost(months[0], jid),
    fetchBuildings(role, jurisdictionId),
    fetchOutages(role, jurisdictionId),
  ]);
  return { months, energy, cost, buildings, outages };
}

const kwhConfig = { value: { label: "kWh", color: "var(--primary)" } } satisfies ChartConfig;
const costConfig = { value: { label: "GHS", color: "#D97706" } } satisfies ChartConfig;

interface BuildingRow {
  building: Building;
  kwh12: number;
  eui: number | null;
  rising: boolean;
}

function EnergyOverview() {
  const { data, loading, error, reload } = useScopedData(loadOverview, EMPTY, "Could not load energy data.");

  const view = useMemo(() => {
    const { months, energy, cost, buildings, outages } = data;
    const kwhByMonth = sumByMonth(
      energy,
      months,
      (r) => r.month,
      (r) => r.consumptionKwh,
    );
    const costByMonth = sumByMonth(
      cost,
      months,
      (r) => r.month,
      (r) => r.amountGhs,
    );
    const series = kwhByMonth.map((m) => m.value);
    const thisMonth = series.at(-1) ?? 0;
    const lastMonth = series.at(-2) ?? 0;
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

    const rows: BuildingRow[] = buildings
      .map((b) => {
        const own = energy.filter((e) => e.buildingId === b.id);
        const kwh12 = own.reduce((s, e) => s + e.consumptionKwh, 0);
        const perMonth = sumByMonth(
          own,
          months,
          (r) => r.month,
          (r) => r.consumptionKwh,
        ).map((m) => m.value);
        return { building: b, kwh12, eui: energyUseIntensity(kwh12, b.floorAreaM2), rising: isUnusualRise(perMonth) };
      })
      .filter((r) => r.kwh12 > 0)
      .sort((a, b) => b.kwh12 - a.kwh12);

    const since = Date.now() - 30 * 86_400_000;
    const outageHours30 = outages
      .filter((o) => new Date(o.startedAt).getTime() >= since)
      .reduce((s, o) => s + o.durationHours, 0);

    return {
      kwhChart: kwhByMonth.map((m) => ({ month: monthLabel(m.month), value: m.value })),
      costChart: costByMonth.map((m) => ({ month: monthLabel(m.month), value: m.value })),
      thisMonth,
      change,
      kwh12: series.reduce((a, b) => a + b, 0),
      cost12: costByMonth.reduce((a, b) => a + b.value, 0),
      outageHours30,
      rows,
      alerts: rows.filter((r) => r.rising),
    };
  }, [data]);

  const columns: Column<BuildingRow>[] = [
    {
      header: "Building",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.building.name}</p>
          <p className="text-xs text-muted-foreground">{r.building.code}</p>
        </div>
      ),
    },
    { header: "Last 12 months", numeric: true, cell: (r) => formatKwh(r.kwh12) },
    {
      header: "kWh per m² per year",
      numeric: true,
      cell: (r) => (r.eui != null ? r.eui.toFixed(0) : <span className="text-muted-foreground">add floor area</span>),
    },
    {
      header: "Trend",
      cell: (r) =>
        r.rising ? (
          <span className="inline-flex items-center gap-1 text-error">
            <AlertTriangle className="size-3.5" /> Unusual rise
          </span>
        ) : (
          <span className="text-muted-foreground">Normal</span>
        ),
    },
  ];

  const hasData = data.energy.length > 0 || data.cost.length > 0;

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader title="Energy" subtitle="Consumption, cost and supply reliability over the last 12 months" />

      {error && (
        <div className="flex items-center justify-between rounded-[10px] border border-error/30 bg-error/5 px-4 py-3">
          <p className="text-sm text-error">{error}</p>
          <button className="text-sm underline" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consumption this month"
          value={loading ? "…" : formatKwh(view.thisMonth)}
          note={
            view.change == null
              ? "No previous month to compare"
              : `${view.change >= 0 ? "+" : ""}${view.change.toFixed(0)}% vs last month`
          }
          tone={view.change != null && view.change > 30 ? "warning" : "default"}
        />
        <StatTile label="Consumption, 12 months" value={loading ? "…" : formatKwh(view.kwh12)} />
        <StatTile label="Billed, 12 months" value={loading ? "…" : formatGhs(view.cost12)} />
        <StatTile label="Outage hours, last 30 days" value={loading ? "…" : view.outageHours30.toFixed(1)} />
      </div>

      {view.alerts.length > 0 && (
        <div className="rounded-[10px] border border-error/30 bg-error/5 px-4 py-3 text-sm">
          <p className="font-medium text-error">Unusual consumption</p>
          <p className="text-muted-foreground">
            {view.alerts.map((a) => a.building.name).join(", ")} used over 30% more this month than their average. Check
            for faults, equipment left on, or a misread meter.
          </p>
        </div>
      )}

      {!loading && !hasData && (
        <div className="rounded-4xl border border-dashed border-outline px-6 py-10 text-center text-sm text-muted-foreground">
          No energy data yet. Start with{" "}
          <Link to="/dashboard/buildings" className="font-medium text-primary underline">
            buildings
          </Link>
          , then{" "}
          <Link to="/dashboard/meters" className="font-medium text-primary underline">
            meters and readings
          </Link>{" "}
          and{" "}
          <Link to="/dashboard/bills" className="font-medium text-primary underline">
            bills
          </Link>
          .
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <MonthlyChart title="Electricity used (kWh)" data={view.kwhChart} config={kwhConfig} loading={loading} />
        <MonthlyChart title="Billed cost (GHS)" data={view.costChart} config={costConfig} loading={loading} />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold tracking-tight">Buildings by consumption</h3>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-4xl" />
        ) : view.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Readings from at least two dates per meter are needed.</p>
        ) : (
          <DataTable rows={view.rows} columns={columns} rowKey={(r) => r.building.id} />
        )}
      </section>
    </div>
  );
}

function MonthlyChart({
  title,
  data,
  config,
  loading,
}: {
  title: string;
  data: { month: string; value: number }[];
  config: ChartConfig;
  loading: boolean;
}) {
  return (
    <div className="rounded-4xl border border-outline bg-[#F9F9F9] px-6 py-5">
      <h3 className="mb-4 text-sm font-medium tracking-tight text-muted-foreground">{title}</h3>
      <div className="h-[240px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ChartContainer config={config} className="h-full w-full">
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#EDEDED" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B6B6B", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B6B6B", fontSize: 11 }} width={56} />
              <ChartTooltip
                content={<ChartTooltipContent className="border-none bg-background" />}
                cursor={{ fill: "#F1F3F1" }}
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
