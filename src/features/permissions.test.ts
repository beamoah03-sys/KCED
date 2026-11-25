import { describe, expect, it } from "vitest";
import { canCreateAsset, canEditAsset } from "@/features/asset/permissions";
import { canCreateWorkOrder, canManageWorkOrder, canProgressWorkOrder } from "@/features/work_order/permissions";
import { assignableRoles, canEditUser } from "@/features/user/permissions";
import type { Asset } from "@/features/asset/schema";
import type { WorkOrder } from "@/features/work_order/schema";
import type { User } from "@/features/user/schema";

const asset = { id: "a1", jurisdictionId: 2 } as Asset;
const order = (over: Partial<WorkOrder> = {}) =>
  ({ id: "w1", jurisdictionId: 2, status: "pending", leadTechnicianId: "tech-1", ...over }) as WorkOrder;
const user = (over: Partial<User> = {}) => ({ id: "u2", role: "technician", jurisdictionId: 2, ...over }) as User;

describe("asset permissions", () => {
  it("lets admins and managers create assets", () => {
    expect(canCreateAsset("admin")).toBe(true);
    expect(canCreateAsset("manager")).toBe(true);
    expect(canCreateAsset("technician")).toBe(false);
  });

  it("limits managers to their jurisdiction", () => {
    const base = { asset, currentUserId: "m", history: [] };
    expect(canEditAsset({ ...base, role: "manager", jurisdictionId: 2 })).toBe(true);
    expect(canEditAsset({ ...base, role: "manager", jurisdictionId: 3 })).toBe(false);
  });

  it("lets technicians edit only while assigned an open order", () => {
    const base = { asset, role: "technician" as const, jurisdictionId: 2, currentUserId: "tech-1" };
    expect(canEditAsset({ ...base, history: [order()] })).toBe(true);
    expect(canEditAsset({ ...base, history: [order({ status: "completed" })] })).toBe(false);
    expect(canEditAsset({ ...base, history: [] })).toBe(false);
  });
});

describe("work order permissions", () => {
  const tech = { role: "technician" as const, jurisdictionId: 2, userId: "tech-1" };
  const otherTech = { ...tech, userId: "tech-2" };
  const manager = { role: "manager" as const, jurisdictionId: 2, userId: "m" };
  const otherManager = { ...manager, jurisdictionId: 9 };

  it("only admins and managers create orders", () => {
    expect(canCreateWorkOrder("technician")).toBe(false);
    expect(canCreateWorkOrder("manager")).toBe(true);
  });
  it("managers manage orders in their jurisdiction only", () => {
    expect(canManageWorkOrder(manager, order())).toBe(true);
    expect(canManageWorkOrder(otherManager, order())).toBe(false);
    expect(canManageWorkOrder(tech, order())).toBe(false);
  });
  it("the lead technician can progress an unfinished order", () => {
    expect(canProgressWorkOrder(tech, order())).toBe(true);
    expect(canProgressWorkOrder(otherTech, order())).toBe(false);
    expect(canProgressWorkOrder(tech, order({ status: "completed" }))).toBe(false);
  });
});

describe("user permissions", () => {
  it("nobody edits themselves or admins", () => {
    const admin = { role: "admin" as const, jurisdictionId: null, userId: "u1" };
    expect(canEditUser(admin, user({ id: "u1" }))).toBe(false);
    expect(canEditUser(admin, user({ role: "admin" }))).toBe(false);
    expect(canEditUser(admin, user())).toBe(true);
  });
  it("managers edit users in their jurisdiction; technicians edit nobody", () => {
    expect(canEditUser({ role: "manager", jurisdictionId: 2, userId: "m" }, user())).toBe(true);
    expect(canEditUser({ role: "manager", jurisdictionId: 3, userId: "m" }, user())).toBe(false);
    expect(canEditUser({ role: "technician", jurisdictionId: 2, userId: "t" }, user())).toBe(false);
  });
  it("nobody can assign the admin role from the UI", () => {
    expect(assignableRoles("admin")).not.toContain("admin");
    expect(assignableRoles("technician")).toEqual([]);
  });
});
