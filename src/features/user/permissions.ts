import type { UserRole } from "@/features/profile/services/profile.service";
import type { User } from "@/features/user/schema";

/**
 * Who may change another user's role or status (UI only; the database's
 * users_guard() trigger enforces the same rules).
 * - Admins: any non-admin user except themselves.
 * - Managers: non-admin users in their own jurisdiction.
 * - Technicians: nobody.
 */
export function canEditUser(
  actor: { role: UserRole | null; jurisdictionId: number | null; userId: string | null },
  target: User,
): boolean {
  if (!actor.userId || target.id === actor.userId || target.role === "admin") return false;
  if (actor.role === "admin") return true;
  return actor.role === "manager" && actor.jurisdictionId !== null && target.jurisdictionId === actor.jurisdictionId;
}

/** Roles an actor may assign. Managers cannot create admins. */
export function assignableRoles(actorRole: UserRole | null): UserRole[] {
  if (actorRole === "admin") return ["manager", "technician"];
  if (actorRole === "manager") return ["manager", "technician"];
  return [];
}
