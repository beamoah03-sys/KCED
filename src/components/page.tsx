import type { ReactNode } from "react";
import { CloudOff, Search, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the list pages, matching the look of the Phase I
 * pages (rounded bordered table, skeleton rows, centred empty/error states).
 */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Right-align numbers. */
  numeric?: boolean;
}

/** A dense, horizontally scrollable table; rows are clickable when `onRowClick` is set. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-4xl border border-outline">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline bg-[#F9F9F9]">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn("whitespace-nowrap px-4 py-2.5 text-left font-medium", c.numeric && "text-right")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "border-b border-outline last:border-b-0",
                onRowClick && "cursor-pointer transition-colors hover:bg-muted/50",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn("px-4 py-3 align-middle", c.numeric && "text-right tabular-nums", c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loading skeleton, error with retry, or empty message; renders children otherwise. */
export function ListState({
  loading,
  error,
  empty,
  onRetry,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyText,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <CloudOff className="size-10 text-muted-foreground" />
        <h3 className="text-lg font-medium">Something went wrong</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={onRetry} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <EmptyIcon className="size-10 text-muted-foreground" />
        <h3 className="text-lg font-medium">{emptyTitle}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Label + control + error message. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** A KPI tile for the energy overview. */
export function StatTile({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-4xl border border-outline bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className={cn("text-xs", tone === "warning" ? "text-error" : "text-muted-foreground")}>{note}</p>}
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "2026-11-12T09:30" for <input type="datetime-local">, in local time. */
export function toLocalInput(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
