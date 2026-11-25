import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/features/service_request/schema";
import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function ImageUploader({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const accepted = picked.filter((f) => {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error(`${f.name}: only JPEG, PNG, WebP or HEIC photos are allowed.`);
        return false;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name} is larger than 5 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length) onChange([...files, ...accepted].slice(0, MAX_IMAGES));
    e.target.value = "";
  }

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col space-y-2">
      <Input
        ref={inputRef}
        type="file"
        id="images"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleSelect}
      />

      {files.length < MAX_IMAGES && (
        <label
          htmlFor="images"
          className="cursor-pointer flex flex-col items-center justify-center gap-2 py-6 px-2 bg-card rounded-control border-dashed border-2 border-outline text-center hover:border-primary transition-colors"
        >
          <Upload strokeWidth={1.5} className="text-muted-foreground" />
          <span className="font-light text-sm text-muted-foreground">
            Tap to add photos of the issue (up to 5, max 5 MB each)
          </span>
        </label>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative group aspect-square">
              <img
                src={url}
                alt={`Selected ${i + 1}`}
                className="h-full w-full object-cover rounded-lg border border-outline"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove image"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center text-sm leading-none shadow hover:brightness-90"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
