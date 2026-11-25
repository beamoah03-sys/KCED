import { useState, type ReactNode } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, parseCsvObjects } from "@/lib/csv";

export interface ImportValidation<T> {
  valid: T[];
  /** One message per bad row, e.g. "Row 4: unknown asset type 'genset'". */
  errors: string[];
}

interface CsvImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Header names for the downloadable template, in order. */
  templateColumns: string[];
  /** One example row for the template. */
  templateExample: string[];
  templateName: string;
  /** Turn parsed rows (keys = snake_case headers) into valid records + errors. */
  validate: (rows: Record<string, string>[]) => ImportValidation<T> | Promise<ImportValidation<T>>;
  /** Save the valid records; return how many were saved. */
  onImport: (records: T[]) => Promise<number>;
  onDone: () => void;
}

const MAX_ROWS = 5000;

/**
 * Upload a CSV, check every row, show what is wrong, then import only when
 * all rows are valid (all-or-nothing keeps the database consistent).
 */
export function CsvImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  templateColumns,
  templateExample,
  templateName,
  validate,
  onImport,
  onDone,
}: CsvImportDialogProps<T>) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportValidation<T> | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName(null);
    setResult(null);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const rows = parseCsvObjects(await file.text());
      if (rows.length === 0) {
        setResult({ valid: [], errors: ["The file has no data rows."] });
        return;
      }
      if (rows.length > MAX_ROWS) {
        setResult({ valid: [], errors: [`Split the file: at most ${MAX_ROWS} rows per import.`] });
        return;
      }
      setResult(await validate(rows));
    } catch (err) {
      setResult({ valid: [], errors: [(err as Error).message || "Could not read the file."] });
    }
  };

  const handleImport = async () => {
    if (!result || result.errors.length > 0 || result.valid.length === 0) return;
    setBusy(true);
    try {
      const n = await onImport(result.valid);
      toast.success(`Imported ${n} row${n === 1 ? "" : "s"}.`);
      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () =>
    downloadCsv(
      templateName,
      [templateExample],
      templateColumns.map((header, i) => ({ header, value: (row: string[]) => row[i] })),
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
        </DialogDescription>

        <Button variant="link" className="h-auto self-start p-0" onClick={downloadTemplate}>
          Download the CSV template
        </Button>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-control border-2 border-dashed border-outline bg-card px-4 py-6 text-center hover:border-primary">
          <FileUp className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{fileName ?? "Choose a .csv file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {result && (
          <div className="space-y-2 text-sm">
            {result.errors.length === 0 ? (
              <p className="text-primary">{result.valid.length} rows ready to import.</p>
            ) : (
              <>
                <p className="text-destructive">
                  Fix {result.errors.length} problem{result.errors.length === 1 ? "" : "s"} and upload again:
                </p>
                <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-destructive">
                  {result.errors.slice(0, 100).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {result.errors.length > 100 && <li>…and {result.errors.length - 100} more</li>}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={busy || !result || result.errors.length > 0 || result.valid.length === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
