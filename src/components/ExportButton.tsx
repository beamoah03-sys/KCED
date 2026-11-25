import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, todayStamp, type CsvColumn } from "@/lib/csv";

interface ExportButtonProps<T> {
  /** File name without date or extension, e.g. "work-orders". */
  name: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
}

/** "Export CSV" button: downloads the rows currently shown (filters applied). */
export function ExportButton<T>({ name, rows, columns, disabled }: ExportButtonProps<T>) {
  return (
    <Button
      variant="outline"
      className="gap-2"
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv(`${name}-${todayStamp()}`, rows, columns)}
    >
      <Download className="size-4" />
      Export
    </Button>
  );
}
