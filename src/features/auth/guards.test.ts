import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/features/auth/guards";

describe("safeRedirect", () => {
  it("allows internal paths", () => {
    expect(safeRedirect("/dashboard/assets?x=1")).toBe("/dashboard/assets?x=1");
  });
  it("blocks external and protocol-relative URLs (open redirect)", () => {
    expect(safeRedirect("https://evil.example")).toBeUndefined();
    expect(safeRedirect("//evil.example")).toBeUndefined();
    expect(safeRedirect(undefined)).toBeUndefined();
  });
});
