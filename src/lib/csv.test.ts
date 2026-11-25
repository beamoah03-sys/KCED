import { describe, expect, it } from "vitest";
import { escapeCsv, parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";

describe("escapeCsv", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsv("abc")).toBe("abc");
    expect(escapeCsv(42)).toBe("42");
    expect(escapeCsv(null)).toBe("");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(escapeCsv("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsv("-12.5")).toBe("-12.5");
  });
});

describe("parseCsv", () => {
  it("round-trips what toCsv writes", () => {
    const rows = [{ a: "x,y", b: 'q"t' }];
    const text = toCsv(rows, [
      { header: "a", value: (r) => r.a },
      { header: "b", value: (r) => r.b },
    ]);
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["x,y", 'q"t'],
    ]);
  });
  it("handles CRLF, a BOM and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("parseCsvObjects", () => {
  it("normalises headers to snake_case", () => {
    expect(parseCsvObjects("Asset Code, Asset Type\nG-1, generator")).toEqual([
      { asset_code: "G-1", asset_type: "generator" },
    ]);
  });
});
