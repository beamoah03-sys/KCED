import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, toLocalInput } from "@/components/page";
import { SelectField } from "@/components/SelectField";
import { useAuth } from "@/lib/auth-context";
import { useJurisdictions } from "@/hooks/use-jurisdictions";
import {
  OUTAGE_CAUSES,
  outageSchema,
  type Building,
  type Outage,
  type OutageFormInput,
  type OutageFormValues,
} from "@/features/energy/schema";
import { saveOutage } from "@/features/energy/services/energy.service";

function defaults(o: Outage | null, jurisdictionId: number | null): OutageFormInput {
  return {
    jurisdiction_id: o?.jurisdictionId ?? (jurisdictionId as number),
    building_id: o?.buildingId ?? "none",
    started_at: o ? toLocalInput(o.startedAt) : toLocalInput(),
    ended_at: o?.endedAt ? toLocalInput(o.endedAt) : "",
    cause: o?.cause ?? "ecg_supply",
    generator_used: o?.generatorUsed ?? false,
    generator_hours: o?.generatorHours != null ? String(o.generatorHours) : "",
    description: o?.description ?? "",
  };
}

export function OutageFormDialog({
  outage,
  buildings,
  open,
  onOpenChange,
  onSaved,
}: {
  outage: Outage | null;
  buildings: Building[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { role, jurisdictionId } = useAuth();
  const jurisdictions = useJurisdictions();
  const isAdmin = role === "admin";
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OutageFormInput, unknown, OutageFormValues>({
    resolver: zodResolver(outageSchema),
    defaultValues: defaults(outage, jurisdictionId),
  });

  useEffect(() => {
    if (open) reset(defaults(outage, isAdmin ? null : jurisdictionId));
  }, [open, outage, reset, jurisdictionId, isAdmin]);

  const selectedJurisdiction = watch("jurisdiction_id");
  const buildingOptions = [
    { value: "none", label: "Whole area / not sure" },
    ...buildings
      .filter((b) => !selectedJurisdiction || b.jurisdictionId === selectedJurisdiction)
      .map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  ];

  const onSubmit = async (values: OutageFormValues) => {
    try {
      await saveOutage(values, outage?.id);
      toast.success(outage ? "Outage updated." : "Outage logged.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{outage ? "Edit outage" : "Log a power outage"}</DialogTitle>
        <DialogDescription>Leave "Power back" empty while the outage is still going on.</DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Jurisdiction" error={errors.jurisdiction_id?.message} className="col-span-2">
            <SelectField
              control={control}
              name="jurisdiction_id"
              numeric
              disabled={!isAdmin}
              invalid={!!errors.jurisdiction_id}
              options={jurisdictions.map((j) => ({ value: String(j.id), label: j.name }))}
            />
          </Field>
          <Field label="Building" className="col-span-2">
            <SelectField control={control} name="building_id" options={buildingOptions} />
          </Field>
          <Field label="Power off" htmlFor="o-start" error={errors.started_at?.message}>
            <Input id="o-start" type="datetime-local" {...register("started_at")} />
          </Field>
          <Field label="Power back" htmlFor="o-end" error={errors.ended_at?.message}>
            <Input id="o-end" type="datetime-local" {...register("ended_at")} />
          </Field>
          <Field label="Cause" error={errors.cause?.message}>
            <SelectField
              control={control}
              name="cause"
              options={OUTAGE_CAUSES.map((c) => ({ value: c.dbValue, label: c.label }))}
            />
          </Field>
          <Field label="Generator hours" htmlFor="o-gh" error={errors.generator_hours?.message}>
            <Input id="o-gh" inputMode="decimal" {...register("generator_hours")} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Controller
              control={control}
              name="generator_used"
              render={({ field }) => (
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
            A generator supplied power during the outage
          </label>
          <Field label="What happened" htmlFor="o-desc" className="col-span-2">
            <Textarea id="o-desc" {...register("description")} />
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
