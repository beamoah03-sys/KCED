import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

/**
 * A shadcn Select bound to a react-hook-form field. `numeric` stores the
 * value as a number (for ids such as jurisdiction_id).
 */
export function SelectField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  options,
  placeholder = "Select…",
  numeric = false,
  disabled,
  id,
  invalid,
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  options: Option[];
  placeholder?: string;
  numeric?: boolean;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
}) {
  return (
    <Controller<T, FieldPath<T>, TOut>
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={
            field.value === undefined || field.value === null || field.value === "" ? undefined : String(field.value)
          }
          onValueChange={(v) => field.onChange(numeric ? Number(v) : v)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
