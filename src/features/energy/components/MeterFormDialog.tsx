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
import {
  METER_KINDS,
  METER_UTILITIES,
  meterSchema,
  type Building,
  type Meter,
  type MeterFormInput,
  type MeterFormValues,
} from "@/features/energy/schema";
import { saveMeter } from "@/features/energy/services/energy.service";

function defaults(m: Meter | null): MeterFormInput {
  return {
    meter_number: m?.meterNumber ?? "",
    building_id: m?.buildingId ?? "",
    utility: m?.utility ?? "grid",
    kind: m?.kind ?? "postpaid",
    ecg_account_number: m?.ecgAccountNumber ?? "",
    multiplier: m ? String(m.multiplier) : "1",
    installed_on: m?.installedOn ?? "",
    notes: m?.notes ?? "",
  };
}

export function MeterFormDialog({
  meter,
  buildings,
  open,
  onOpenChange,
  onSaved,
}: {
  meter: Meter | null;
  /** Buildings the user may attach meters to. */
  buildings: Building[];
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
  } = useForm<MeterFormInput, unknown, MeterFormValues>({
    resolver: zodResolver(meterSchema),
    defaultValues: defaults(meter),
  });

  useEffect(() => {
    if (open) reset(defaults(meter));
  }, [open, meter, reset]);

  const onSubmit = async (values: MeterFormValues) => {
    try {
      await saveMeter(values, meter?.id);
      toast.success(meter ? "Meter updated." : "Meter added.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{meter ? `Edit meter ${meter.meterNumber}` : "Add meter"}</DialogTitle>
        <DialogDescription>
          The multiplier is the CT ratio printed on the meter; use 1 for direct-connected meters.
        </DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Meter number" htmlFor="m-num" error={errors.meter_number?.message}>
            <Input id="m-num" {...register("meter_number")} aria-invalid={!!errors.meter_number} />
          </Field>
          <Field label="ECG account number" htmlFor="m-acc">
            <Input id="m-acc" {...register("ecg_account_number")} />
          </Field>
          <Field label="Building" error={errors.building_id?.message} className="col-span-2">
            <SelectField
              control={control}
              name="building_id"
              placeholder="Select a building…"
              invalid={!!errors.building_id}
              options={buildings.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
            />
          </Field>
          <Field label="Supply" error={errors.utility?.message}>
            <SelectField
              control={control}
              name="utility"
              options={METER_UTILITIES.map((u) => ({ value: u.dbValue, label: u.label }))}
            />
          </Field>
          <Field label="Meter type" error={errors.kind?.message}>
            <SelectField
              control={control}
              name="kind"
              options={METER_KINDS.map((k) => ({ value: k.dbValue, label: k.label }))}
            />
          </Field>
          <Field label="Multiplier" htmlFor="m-mult" error={errors.multiplier?.message}>
            <Input id="m-mult" inputMode="decimal" {...register("multiplier")} />
          </Field>
          <Field label="Installed on" htmlFor="m-inst" error={errors.installed_on?.message}>
            <Input id="m-inst" type="date" {...register("installed_on")} />
          </Field>
          <Field label="Notes" htmlFor="m-notes" className="col-span-2">
            <Textarea id="m-notes" {...register("notes")} />
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
