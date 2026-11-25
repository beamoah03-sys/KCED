import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, formatDateTime, toLocalInput } from "@/components/page";
import { consumptionFromReadings, formatKwh } from "@/features/energy/calc";
import {
  METER_KINDS,
  METER_UTILITIES,
  labelOf,
  readingSchema,
  type Meter,
  type MeterReading,
  type ReadingFormInput,
  type ReadingFormValues,
} from "@/features/energy/schema";
import { addReading, deleteReading, fetchReadings } from "@/features/energy/services/energy.service";

/**
 * One meter's readings: newest first, with the consumption since the
 * previous reading, plus a quick form to record a new reading.
 */
export function MeterReadingsSheet({
  meter,
  open,
  onOpenChange,
  canRecord,
  canCorrect,
  onChanged,
}: {
  meter: Meter | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Technicians and managers in the meter's jurisdiction. */
  canRecord: boolean;
  /** Managers may delete wrong readings. */
  canCorrect: boolean;
  onChanged: () => void;
}) {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!meter) return;
    setLoading(true);
    try {
      setReadings(await fetchReadings(meter.id));
    } catch {
      toast.error("Could not load readings.");
    } finally {
      setLoading(false);
    }
  }, [meter]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const consumptionByReading = useMemo(() => {
    const periods = consumptionFromReadings(readings, meter?.multiplier ?? 1);
    return new Map(periods.map((p) => [p.to, p.kwh]));
  }, [readings, meter]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReadingFormInput, unknown, ReadingFormValues>({
    resolver: zodResolver(readingSchema),
    defaultValues: { reading_at: toLocalInput(), reading_kwh: "", notes: "" },
  });

  const onSubmit = async (values: ReadingFormValues) => {
    if (!meter) return;
    try {
      await addReading(meter.id, values);
      toast.success("Reading saved.");
      reset({ reading_at: toLocalInput(), reading_kwh: "", notes: "" });
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (r: MeterReading) => {
    if (!window.confirm(`Delete the reading of ${r.readingKwh} kWh from ${formatDateTime(r.readingAt)}?`)) return;
    try {
      await deleteReading(r.id);
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!meter) return null;
  const last = readings[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-6 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <SheetTitle>Meter {meter.meterNumber}</SheetTitle>
            <SheetDescription>
              {meter.buildingName ?? "Unknown building"} · {labelOf(METER_UTILITIES, meter.utility)} ·{" "}
              {labelOf(METER_KINDS, meter.kind)} · multiplier ×{meter.multiplier}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm">
              <X />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </div>

        {canRecord && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 grid gap-3 rounded-4xl border border-outline bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
            noValidate
          >
            <Field label="Date and time" htmlFor="r-at" error={errors.reading_at?.message}>
              <Input id="r-at" type="datetime-local" max={toLocalInput()} {...register("reading_at")} />
            </Field>
            <Field
              label="Register (kWh)"
              htmlFor="r-kwh"
              error={errors.reading_kwh?.message}
              hint={last ? `Last: ${last.readingKwh.toLocaleString()} kWh` : "First reading for this meter"}
            >
              <Input id="r-kwh" inputMode="decimal" {...register("reading_kwh")} aria-invalid={!!errors.reading_kwh} />
            </Field>
            <div className="flex items-end pb-[1.375rem]">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Save reading"}
              </Button>
            </div>
            <Field
              label="Note"
              htmlFor="r-note"
              hint="Required if the meter was replaced or reset (reading lower than before)."
              className="sm:col-span-3"
            >
              <Input id="r-note" {...register("notes")} />
            </Field>
          </form>
        )}

        <h3 className="mt-6 font-semibold tracking-tight">Readings</h3>
        {loading ? (
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : readings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No readings yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-4xl border border-outline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline bg-[#F9F9F9] text-left">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 text-right font-medium">Register</th>
                  <th className="px-4 py-2 text-right font-medium">Used since previous</th>
                  <th className="px-4 py-2 font-medium">By</th>
                  {canCorrect && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id} className="border-b border-outline last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2">
                      {formatDateTime(r.readingAt)}
                      {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.readingKwh.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {consumptionByReading.has(r.readingAt) ? formatKwh(consumptionByReading.get(r.readingAt)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.source === "import" ? "Import" : (r.recordedByName ?? "—")}
                    </td>
                    {canCorrect && (
                      <td className="px-2 py-2">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(r)}>
                          <Trash2 className="size-4 text-muted-foreground" />
                          <span className="sr-only">Delete reading</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
