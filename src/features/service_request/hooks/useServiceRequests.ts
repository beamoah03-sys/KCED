import { fetchServiceRequests } from "@/features/service_request/services/service_request.service";
import type { ServiceRequest } from "@/features/service_request/schema";
import { useScopedData } from "@/hooks/use-scoped-data";

const EMPTY: ServiceRequest[] = [];

/**
 * Loads the service requests list. The web counterpart of the kced_mobile
 * `ServiceRequestsController.load()`; `reload` replaces pull-to-refresh.
 */
export function useServiceRequests() {
  const { data, ...rest } = useScopedData(
    fetchServiceRequests,
    EMPTY,
    "Could not load service requests. Check your connection and try again.",
  );
  return { requests: data, ...rest };
}
