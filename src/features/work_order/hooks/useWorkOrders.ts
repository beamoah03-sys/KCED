import { fetchWorkOrders } from "@/features/work_order/services/work_order.service";
import type { WorkOrder } from "@/features/work_order/schema";
import { useScopedData } from "@/hooks/use-scoped-data";

const EMPTY: WorkOrder[] = [];

/**
 * Loads the work orders list. The web counterpart of the kced_mobile
 * `WorkOrdersController.load()`; `reload` is called after create/edit/delete.
 */
export function useWorkOrders() {
  const { data, ...rest } = useScopedData(
    fetchWorkOrders,
    EMPTY,
    "Could not load work orders. Check your connection and try again.",
  );
  return { workOrders: data, ...rest };
}
