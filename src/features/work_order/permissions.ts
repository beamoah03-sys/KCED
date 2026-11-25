import type { UserRole } from "@/features/profile/services/profile.service";
import type { WorkOrder } from "@/features/work_order/schema";

/**
 * UI-side work order rules. They only decide which buttons to show: the
 * database enforces the same rules (supabase/migrations/*_security.sql).
 */

interface Actor {
  role: UserRole | null;
  jurisdictionId: number | null;
  userId: string | null;
}

/** Create work orders: admins anywhere, managers in their jurisdiction. */
export function canCreateWorkOrder(role: UserRole | null): boolean {
  return role === "admin" || role === "manager";
}

/** Edit details, reassign or delete an order. */
export function canManageWorkOrder({ role, jurisdictionId }: Actor, order: WorkOrder): boolean {
  if (role === "admin") return true;
  return role === "manager" && jurisdictionId !== null && order.jurisdictionId === jurisdictionId;
}

/** Move an order through pending -> in progress -> completed, and link an asset. */
export function canProgressWorkOrder(actor: Actor, order: WorkOrder): boolean {
  if (order.status === "completed") return false;
  if (canManageWorkOrder(actor, order)) return true;
  return actor.role === "technician" && actor.userId !== null && order.leadTechnicianId === actor.userId;
}
