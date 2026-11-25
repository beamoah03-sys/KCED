import { env } from "@/lib/env";
import { errorMessage, fetchAllRows, supabase } from "@/lib/supabase";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  type Jurisdiction,
  type ServiceRequest,
  type ServiceRequestStatus,
  type ServiceRequestValues,
} from "@/features/service_request/schema";
import type { UserRole } from "@/features/profile/services/profile.service";

export const TABLE = "service_requests";
/** Private bucket: uploads are public, viewing needs a staff session. */
export const BUCKET = "service-request-images";

/**
 * Load the jurisdictions (areas) for the request form's picker, ordered for
 * display. Mirrors the kced_mobile `fetchJurisdictions`. Throws on failure.
 */
export async function fetchJurisdictions(): Promise<Jurisdiction[]> {
  const { data, error } = await supabase
    .from("jurisdictions")
    .select("id, name, code, is_maintenance_yard")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((j) => ({ id: j.id, name: j.name, code: j.code }));
}

/** Check files against the bucket's limits before uploading. Returns an
 *  error message, or null when the files are acceptable. */
export function validateImages(files: File[]): string | null {
  if (files.length > MAX_IMAGES) return `You can attach up to ${MAX_IMAGES} photos.`;
  for (const f of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) return `${f.name}: only JPEG, PNG, WebP or HEIC photos are allowed.`;
    if (f.size > MAX_IMAGE_BYTES) return `${f.name} is larger than 5 MB.`;
  }
  return null;
}

/**
 * Upload one image and return its storage path (e.g. "requests/2026-11/uuid.jpg").
 * The bucket is private, so staff view images through signed URLs.
 */
export async function uploadImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const month = new Date().toISOString().slice(0, 7);
  const path = `requests/${month}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/**
 * Turn stored image references into viewable URLs: signed URLs (1 hour) for
 * storage paths, and Phase I's full public URLs unchanged.
 */
export async function resolveImageUrls(refs: string[]): Promise<string[]> {
  const paths = refs.filter((r) => !/^https?:\/\//.test(r));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }
  return refs.map((r) => signed.get(r) ?? r).filter((r) => /^https?:\/\//.test(r));
}

/**
 * Submit a service request: upload any images, then create the request with
 * the `submit_service_request` database function. Returns the request number
 * (e.g. "SR-2026-00042") so the reporter can track it.
 */
export async function submitServiceRequest(values: ServiceRequestValues, files: File[]): Promise<string> {
  const invalid = validateImages(files);
  if (invalid) throw new Error(invalid);

  const images = await Promise.all(files.map(uploadImage));
  const { data, error } = await supabase.rpc("submit_service_request", {
    p_issue: values.issue,
    p_description: values.description,
    p_location: values.location,
    p_reporter: values.reporter,
    p_reporter_contact: values.reporter_contact,
    p_jurisdiction_id: values.jurisdiction_id,
    p_urgency: values.urgency,
    p_images: images,
  });
  if (error) throw new Error(errorMessage(error, "Could not submit your request. Please try again."));
  return String(data);
}

/** Map a raw `service_requests` row (with joined jurisdiction) to a `ServiceRequest`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapServiceRequest(row: Record<string, any>): ServiceRequest {
  const jurisdiction = row.jurisdictions ?? null;
  return {
    id: row.id,
    requestNumber: row.request_number?.toString() ?? null,
    issue: row.issue ?? "",
    description: row.description ?? "",
    location: row.location ?? "",
    reporter: row.reporter ?? "",
    reporterContact: row.reporter_contact ?? "",
    urgency: row.urgency ?? "normal",
    submittedImages: (row.submitted_images ?? []).map(String),
    status: row.status ?? "submitted",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    jurisdictionId: row.jurisdiction_id ?? null,
    jurisdictionName: jurisdiction?.name ?? null,
    jurisdictionCode: jurisdiction?.code ?? null,
  };
}

/**
 * Load service requests, newest first, with their jurisdiction name/code.
 * Admins see all; managers/technicians see only their jurisdiction.
 */
export async function fetchServiceRequests(
  role?: UserRole | null,
  jurisdictionId?: number | null,
): Promise<ServiceRequest[]> {
  const scoped = role && role !== "admin" && jurisdictionId != null;
  const rows = await fetchAllRows((from, to) => {
    let query = supabase.from(TABLE).select("*, jurisdictions(name, code)");
    if (scoped) query = query.eq("jurisdiction_id", jurisdictionId!);
    return query.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  return rows.map(mapServiceRequest);
}

/**
 * Cancel a service request (soft delete — sets status to "cancelled").
 * Refuses if a work order has already been created from the request.
 */
export async function cancelServiceRequest(id: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("service_request_id", id);
  if (countError) throw new Error("Could not cancel the request. Please try again.");
  if ((count ?? 0) > 0) {
    throw new Error("This request has a work order attached. Delete the work order first.");
  }

  const { error } = await supabase.from(TABLE).update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(errorMessage(error, "Could not cancel the request. Please try again."));
}

/** Reopen a cancelled service request — puts it back to "submitted". */
export async function reopenServiceRequest(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ status: "submitted" }).eq("id", id);
  if (error) throw new Error(errorMessage(error, "Could not reopen the request. Please try again."));
}

/** What the public tracking page shows about a request. */
export interface TrackedRequest {
  requestNumber: string;
  status: ServiceRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Look up a request by its `request_number` for the public tracking page,
 * through the `track-request` Edge Function (no personal data is returned).
 * Returns null when no request matches.
 */
export async function trackServiceRequest(requestNumber: string): Promise<TrackedRequest | null> {
  const res = await fetch(`${env.supabaseUrl}/functions/v1/track-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
    },
    body: JSON.stringify({ requestNumber: requestNumber.trim().toUpperCase() }),
  });

  if (!res.ok) throw new Error(`Tracking request failed: ${res.statusText}`);

  const { data, error } = await res.json();
  if (error) throw new Error(error);
  if (!data) return null;

  return {
    requestNumber: data.requestNumber,
    status: data.status as ServiceRequestStatus,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}
