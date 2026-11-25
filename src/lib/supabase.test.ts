import { describe, expect, it } from "vitest";
import { errorMessage, fetchAllRows } from "@/lib/supabase";

describe("fetchAllRows", () => {
  it("pages until a short page comes back", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllRows<number>(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    });
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops after one call for small tables", async () => {
    let n = 0;
    await fetchAllRows(async () => {
      n++;
      return { data: [1, 2, 3], error: null };
    });
    expect(n).toBe(1);
  });

  it("throws the query error", async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});

describe("errorMessage", () => {
  it("shows trigger messages as they are", () => {
    expect(errorMessage({ code: "P0001", message: "Too many requests" })).toBe("Too many requests");
  });
  it("explains unique violations", () => {
    expect(errorMessage({ code: "23505", message: "duplicate key" })).toBe("That value is already in use.");
  });
  it("falls back when there is nothing useful", () => {
    expect(errorMessage(null, "Fallback")).toBe("Fallback");
  });
});
