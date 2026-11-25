import { describe, expect, it } from "vitest";
import { serviceRequestSchema } from "@/features/service_request/schema";

const base = {
  issue: "Faulty A/C",
  description: "Not cooling",
  jurisdiction_id: 3,
  location: "Petroleum Building",
  reporter: "Ama",
  reporter_contact: "24 123 4567",
};

describe("serviceRequestSchema", () => {
  it("normalises the phone number to +233 and defaults urgency", () => {
    const parsed = serviceRequestSchema.parse(base);
    expect(parsed.reporter_contact).toBe("+233241234567");
    expect(parsed.urgency).toBe("normal");
  });

  it("rejects a phone number that is not 9 digits", () => {
    expect(serviceRequestSchema.safeParse({ ...base, reporter_contact: "0241234567" }).success).toBe(false);
  });

  it("requires an area", () => {
    expect(serviceRequestSchema.safeParse({ ...base, jurisdiction_id: undefined }).success).toBe(false);
  });
});
