import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** The new request's number, e.g. "SR-2026-00042". */
  requestNumber: string;
  onReset: () => void;
};

export function SuccessCard({ requestNumber, onReset }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the number is still on screen */
    }
  };

  return (
    <div className="text-center space-y-5 animate-in fade-in zoom-in duration-300 py-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-soft">
        <Check size={28} className="text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-medium tracking-tight">Request Submitted</h2>
        <p className="text-sm text-muted-foreground font-light">
          Our maintenance team will review it shortly. Keep this number to track your request:
        </p>
      </div>

      <button
        type="button"
        onClick={copy}
        className="mx-auto flex items-center gap-2 rounded-control border border-outline bg-card px-4 py-2 font-mono text-lg font-semibold tracking-wide"
        aria-label={`Copy request number ${requestNumber}`}
      >
        {requestNumber}
        <Copy className="size-4 text-muted-foreground" />
      </button>
      <p className="h-4 text-xs text-primary">{copied ? "Copied" : ""}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link to="/track-service-request" search={{ ref: requestNumber }}>
            Track this request
          </Link>
        </Button>
        <Button variant="outline" onClick={onReset}>
          Submit another request
        </Button>
      </div>
    </div>
  );
}
