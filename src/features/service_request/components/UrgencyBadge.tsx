import { REQUEST_URGENCIES, type RequestUrgency } from "@/features/service_request/schema";

const COLORS: Record<RequestUrgency, { bg: string; fg: string }> = {
  low: { bg: "#EDEDED", fg: "#6B6B6B" },
  normal: { bg: "#E8F0EB", fg: "#1B6E44" },
  urgent: { bg: "#FDECD2", fg: "#8A5A00" },
  emergency: { bg: "#FBEAE9", fg: "#B3261E" },
};

/** Small coloured label for a request's urgency. Hidden for "normal" when `quiet`. */
export function UrgencyBadge({ urgency, quiet = false }: { urgency: RequestUrgency; quiet?: boolean }) {
  if (quiet && urgency === "normal") return null;
  const { bg, fg } = COLORS[urgency] ?? COLORS.normal;
  const label = REQUEST_URGENCIES.find((u) => u.dbValue === urgency)?.label.split(" (")[0] ?? "Normal";
  return (
    <span
      className="inline-block whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}
