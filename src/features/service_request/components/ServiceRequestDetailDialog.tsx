import { Briefcase, Building2, MapPin, Phone, RotateCcw, Trash2, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { resolveImageUrls } from "@/features/service_request/services/service_request.service";
import { UrgencyBadge } from "@/features/service_request/components/UrgencyBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { displayNumber, type ServiceRequest } from "@/features/service_request/schema";
import { RequestStatusPill } from "@/features/service_request/components/RequestStatusPill";

interface ServiceRequestDetailDialogProps {
  /** The request to show; null when the dialog is closed. */
  request: ServiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkOrder: (request: ServiceRequest) => void;
  onDelete: (request: ServiceRequest) => void;
  onReopen: (request: ServiceRequest) => void;
}

/** "20 Jul 2026, 5:00 PM" — matches the mobile `d MMM yyyy, h:mm a` format. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day}, ${time}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function IconLine({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-sm font-medium">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      {text}
    </p>
  );
}

/**
 * Full view of a single service request — the web analogue of the mobile
 * `ServiceRequestDetailScreen`, with the create-work-order / delete actions
 * at the bottom.
 */
export function ServiceRequestDetailDialog({
  request,
  open,
  onOpenChange,
  onCreateWorkOrder,
  onDelete,
  onReopen,
}: ServiceRequestDetailDialogProps) {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Images live in a private bucket: swap stored paths for signed URLs.
  useEffect(() => {
    let cancelled = false;
    setImageUrls([]);
    if (request && request.submittedImages.length > 0) {
      resolveImageUrls(request.submittedImages)
        .then((urls) => !cancelled && setImageUrls(urls))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <DialogTitle>Request {displayNumber(request)}</DialogTitle>
            <DialogDescription>{request.createdAt ? formatDate(request.createdAt) : "Date unknown"}</DialogDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <RequestStatusPill status={request.status} />
            <UrgencyBadge urgency={request.urgency} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Issue">
            <p className="text-sm font-medium">{request.issue}</p>
          </Section>

          {request.description && (
            <Section title="Description">
              <p className="whitespace-pre-wrap text-sm">{request.description}</p>
            </Section>
          )}

          <Section title="Location">
            <IconLine icon={MapPin} text={request.location || "Not specified"} />
          </Section>

          <Section title="Jurisdiction">
            <IconLine icon={Building2} text={request.jurisdictionName ?? request.jurisdictionCode ?? "Unassigned"} />
          </Section>

          <Section title="Reporter">
            <div className="flex flex-col gap-1.5">
              <IconLine icon={User} text={request.reporter || "Anonymous"} />
              {request.reporterContact && <IconLine icon={Phone} text={request.reporterContact} />}
            </div>
          </Section>

          {imageUrls.length > 0 && (
            <Section title="Photos">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={url}
                      alt="Submitted photo"
                      className="size-24 rounded-[10px] border border-outline object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        {canManage && (
          <div className="mt-2 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => onCreateWorkOrder(request)}
              disabled={request.status === "cancelled" || request.status === "resolved"}
            >
              <Briefcase /> Create Work Order
            </Button>
            {request.status === "cancelled" ? (
              <Button variant="outline" size="icon-lg" onClick={() => onReopen(request)}>
                <RotateCcw />
                <span className="sr-only">Reopen request</span>
              </Button>
            ) : (
              <Button variant="destructive" size="icon-lg" onClick={() => onDelete(request)}>
                <Trash2 />
                <span className="sr-only">Cancel request</span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
