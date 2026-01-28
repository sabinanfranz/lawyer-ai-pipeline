import { describe, it, expect } from "vitest";
import { normalizeComplianceIssues, normalizeComplianceReportPayload } from "../prismaContentRepo";

describe("normalizeComplianceIssues", () => {
  it("keeps valid payload shape", () => {
    const raw = [{ category: "x", snippet: "s", reason: "r", suggestion: "g" }];
    expect(normalizeComplianceIssues(raw)).toEqual(raw);
  });

  it("maps legacy token/text/message/fix", () => {
    const raw = [{ category: "x", token: "abc", message: "m", fix: "f" }];
    expect(normalizeComplianceIssues(raw)).toEqual([
      { category: "x", snippet: "abc", reason: "m", suggestion: "f" },
    ]);
  });

  it("returns [] for invalid inputs", () => {
    expect(normalizeComplianceIssues(null)).toEqual([]);
    expect(normalizeComplianceIssues("str")).toEqual([]);
    expect(normalizeComplianceIssues({})).toEqual([]);
  });
});

describe("normalizeComplianceReportPayload", () => {
  it("defaults fields and normalizes issues", () => {
    const raw = { summary: "s", issues: [{ category: "x", token: "abc" }] };
    expect(normalizeComplianceReportPayload(raw)).toEqual({
      risk_score: 0,
      summary: "s",
      issues: [{ category: "x", snippet: "abc", reason: "", suggestion: "" }],
    });
  });
});
