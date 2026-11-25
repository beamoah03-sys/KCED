import { z } from "zod";

/** A row from the `jurisdictions` table, fetched to populate the area picker. */
export interface Jurisdiction {
  id: number;
  name: string;
  code: string;
}

const required = (message = "This field is required.") => z.string().trim().min(1, message);

/** The 9 digits after the fixed +233 prefix the form renders; normalized to
 * the full +233… number for the insert. */
const ghanaPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .refine((v) => /^\d{9}$/.test(v), {
    message: "Enter the 9 digits after +233 (e.g. 241234567).",
  })
  .transform((v) => `+233${v}`);

/** Single source of truth: validates the form AND infers its types. */
export const serviceRequestSchema = z.object({
  issue: required(),
  description: required(),
  // The picker holds the selected jurisdiction's id (FK into `jurisdictions`).
  jurisdiction_id: z.number({ error: "Please select an area." }).int().positive("Please select an area."),
  location: required(),
  reporter: required(),
  reporter_contact: ghanaPhone,
  urgency: z.enum(["low", "normal", "urgent", "emergency"]).default("normal"),
});

/** Urgency levels, in display order. Mirrors the `request_urgency` enum. */
export const REQUEST_URGENCIES = [
  { dbValue: "low", label: "Low" },
  { dbValue: "normal", label: "Normal" },
  { dbValue: "urgent", label: "Urgent" },
  { dbValue: "emergency", label: "Emergency (safety risk)" },
] as const;

export type RequestUrgency = (typeof REQUEST_URGENCIES)[number]["dbValue"];

/** Upload limits, matching the `service-request-images` bucket. */
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Form field values (as typed into the form, before defaults apply). */
export type ServiceRequestFormInput = z.input<typeof serviceRequestSchema>;
/** Validated values. */
export type ServiceRequestValues = z.output<typeof serviceRequestSchema>;

/**
 * Service request statuses, in display order. Mirrors the
 * `service_request_status` Postgres enum.
 */
export const SERVICE_REQUEST_STATUSES = [
  { dbValue: "submitted", label: "Submitted" },
  { dbValue: "assigned", label: "Assigned" },
  { dbValue: "in progress", label: "In Progress" },
  { dbValue: "resolved", label: "Resolved" },
  { dbValue: "cancelled", label: "Cancelled" },
] as const;

export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number]["dbValue"];

/** A row from the `service_requests` table (jurisdiction name/code joined in). */
export interface ServiceRequest {
  id: string;
  /** Human-friendly request number; null for rows created before the column. */
  requestNumber: string | null;
  issue: string;
  description: string;
  location: string;
  reporter: string;
  reporterContact: string;
  urgency: RequestUrgency;
  /** Storage paths (new) or full public URLs (Phase I rows). */
  submittedImages: string[];
  status: ServiceRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
  /** Null for requests not tied to a jurisdiction. */
  jurisdictionId: number | null;
  /** Joined from `jurisdictions(name)`; null when unassigned. */
  jurisdictionName: string | null;
  /** Joined from `jurisdictions(code)`; null when unassigned. */
  jurisdictionCode: string | null;
}

/** What to show as the request's number: `request_number` when present,
 * falling back to a short `#id` for older rows. */
export function displayNumber(request: ServiceRequest): string {
  return request.requestNumber ?? `#${request.id.slice(0, 8)}`;
}
