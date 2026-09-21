import { describe, expect, it } from "vitest";

import {
  findDeltagareByEmail,
  findDeltagareByName,
  normalizePersonName,
} from "./deltagare-auth";
import { emptyDnsFeeTracker } from "./dns-fee-types";

describe("deltagare name/email match", () => {
  const data = emptyDnsFeeTracker(2026);
  data.members = [
    { personId: "1", personName: "Anna Andersson", email: "anna@example.com" },
    { personId: "2", personName: "Bert Bertilsson", email: null },
    { personId: "3", personName: "Anna Andersson", email: "anna2@example.com" },
  ];

  it("normalizes names", () => {
    expect(normalizePersonName("  Anna   Andersson ")).toBe("anna andersson");
  });

  it("finds by email case-insensitively", () => {
    expect(findDeltagareByEmail(data, "Anna@Example.com")?.personId).toBe("1");
    expect(findDeltagareByEmail(data, "missing@example.com")).toBeNull();
  });

  it("finds by name and returns multiples", () => {
    const hits = findDeltagareByName(data, "anna andersson");
    expect(hits).toHaveLength(2);
    expect(findDeltagareByName(data, "Okänd")).toHaveLength(0);
  });
});
