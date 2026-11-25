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
import { useAuth } from "@/lib/auth-context";
import { useJurisdictions } from "@/hooks/use-jurisdictions";
import {
  BUILDING_CATEGORIES,
  buildingSchema,
  type Building,
  type BuildingFormInput,
  type BuildingFormValues,
} from "@/features/energy/schema";
import { saveBuilding } from "@/features/energy/services/energy.service";

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

function defaults(b: Building | null, jurisdictionId: number | null): BuildingFormInput {
  return {
    code: b?.code ?? "",
    name: b?.name ?? "",
    jurisdiction_id: b?.jurisdictionId ?? (jurisdictionId as number),
    category: b?.category ?? "academic",
    floor_area_m2: str(b?.floorAreaM2),
    occupants: str(b?.occupants),
    latitude: str(b?.latitude),
    longitude: str(b?.longitude),
    notes: b?.notes ?? "",
  };
}

export function BuildingFormDialog({
  building,
  open,
  onOpenChange,
  onSaved,
}: {
  building: Building | null;
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
    formState: { errors, isSubmitting },
  } = useForm<BuildingFormInput, unknown, BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: defaults(building, jurisdictionId),
  });

  useEffect(() => {
    if (open) reset(defaults(building, isAdmin ? null : jurisdictionId));
  }, [open, building, reset, jurisdictionId, isAdmin]);

  const onSubmit = async (values: BuildingFormValues) => {
    try {
      await saveBuilding(values, building?.id);
      toast.success(building ? "Building updated." : "Building added.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{building ? `Edit ${building.name}` : "Add building"}</DialogTitle>
        <DialogDescription>Floor area lets the system compare buildings fairly (kWh per m²).</DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Code" htmlFor="b-code" error={errors.code?.message} hint="e.g. COE-PB">
            <Input id="b-code" {...register("code")} aria-invalid={!!errors.code} />
          </Field>
          <Field label="Category" error={errors.category?.message}>
            <SelectField
              control={control}
              name="category"
              options={BUILDING_CATEGORIES.map((c) => ({ value: c.dbValue, label: c.label }))}
            />
          </Field>
          <Field label="Name" htmlFor="b-name" error={errors.name?.message} className="col-span-2">
            <Input id="b-name" {...register("name")} aria-invalid={!!errors.name} />
          </Field>
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
          <Field label="Floor area (m²)" htmlFor="b-area" error={errors.floor_area_m2?.message}>
            <Input id="b-area" inputMode="decimal" {...register("floor_area_m2")} />
          </Field>
          <Field label="Occupants" htmlFor="b-occ" error={errors.occupants?.message}>
            <Input id="b-occ" inputMode="numeric" {...register("occupants")} />
          </Field>
          <Field label="Latitude" htmlFor="b-lat" error={errors.latitude?.message}>
            <Input id="b-lat" inputMode="decimal" placeholder="6.6745" {...register("latitude")} />
          </Field>
          <Field label="Longitude" htmlFor="b-lng" error={errors.longitude?.message}>
            <Input id="b-lng" inputMode="decimal" placeholder="-1.5716" {...register("longitude")} />
          </Field>
          <Field label="Notes" htmlFor="b-notes" className="col-span-2">
            <Textarea id="b-notes" {...register("notes")} />
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
