import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/page";
import { SelectField } from "@/components/SelectField";
import { billSchema, type Bill, type BillFormInput, type BillFormValues, type Meter } from "@/features/energy/schema";
import { saveBill } from "@/features/energy/services/energy.service";

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

function defaults(b: Bill | null): BillFormInput {
  return {
    meter_id: b?.meterId ?? "",
    period_start: b?.periodStart ?? "",
    period_end: b?.periodEnd ?? "",
    consumption_kwh: str(b?.consumptionKwh),
    max_demand_kva: str(b?.maxDemandKva),
    amount_ghs: b ? String(b.amountGhs) : "",
    due_date: b?.dueDate ?? "",
    paid_at: b?.paidAt ?? "",
    notes: b?.notes ?? "",
  };
}

export function BillFormDialog({
  bill,
  meters,
  open,
  onOpenChange,
  onSaved,
}: {
  bill: Bill | null;
  meters: Meter[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BillFormInput, unknown, BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: defaults(bill),
  });

  useEffect(() => {
    if (open) reset(defaults(bill));
  }, [open, bill, reset]);

  const onSubmit = async (values: BillFormValues) => {
    try {
      await saveBill(values, bill?.id);
      toast.success(bill ? "Bill updated." : "Bill recorded.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{bill ? "Edit bill" : "Record a bill"}</DialogTitle>
        <DialogDescription>Copy the figures from the ECG bill. The building is taken from the meter.</DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Meter" error={errors.meter_id?.message} className="col-span-2">
            <SelectField
              control={control}
              name="meter_id"
              placeholder="Select a meter…"
              invalid={!!errors.meter_id}
              options={meters.map((m) => ({
                value: m.id,
                label: `${m.meterNumber} · ${m.buildingName ?? ""}${m.ecgAccountNumber ? ` · acc ${m.ecgAccountNumber}` : ""}`,
              }))}
            />
          </Field>
          <Field label="Period start" htmlFor="bl-s" error={errors.period_start?.message}>
            <Input id="bl-s" type="date" {...register("period_start")} />
          </Field>
          <Field label="Period end" htmlFor="bl-e" error={errors.period_end?.message}>
            <Input id="bl-e" type="date" {...register("period_end")} />
          </Field>
          <Field label="Amount (GHS)" htmlFor="bl-amt" error={errors.amount_ghs?.message}>
            <Input id="bl-amt" inputMode="decimal" {...register("amount_ghs")} aria-invalid={!!errors.amount_ghs} />
          </Field>
          <Field label="Billed kWh" htmlFor="bl-kwh" error={errors.consumption_kwh?.message}>
            <Input id="bl-kwh" inputMode="decimal" {...register("consumption_kwh")} />
          </Field>
          <Field label="Max demand (kVA)" htmlFor="bl-kva" error={errors.max_demand_kva?.message}>
            <Input id="bl-kva" inputMode="decimal" {...register("max_demand_kva")} />
          </Field>
          <Field label="Due date" htmlFor="bl-due">
            <Input id="bl-due" type="date" {...register("due_date")} />
          </Field>
          <Field label="Paid on" htmlFor="bl-paid" hint="Leave empty if unpaid.">
            <Input id="bl-paid" type="date" {...register("paid_at")} />
          </Field>
          <Field label="Notes" htmlFor="bl-notes" className="col-span-2">
            <Textarea id="bl-notes" {...register("notes")} />
          </Field>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
