import { describe, it, expect } from "vitest";
import { normalizeComplianceIssues, normalizeComplianceReport } from "./prismaContentRepo";

describe("normalizeComplianceIssues", () => {
  it("keeps fully shaped issues as-is", () => {
    const raw = [
      {
        category: "superlative_absolute",
        snippet: "최고",
        reason: "최상급 표현",
        suggestion: "완곡화",
      },
    ];

    const normalized = normalizeComplianceIssues(raw);
    expect(normalized).toEqual(raw);
  });

  it("maps legacy token/text/message/fix fields to snippet/reason/suggestion", () => {
    const raw = [
      { category: "must_avoid", token: "로톡" },
      { category: "comparison_defamation", text: "다른 로펌보다", message: "비교 금지", fix: "일반화" },
    ];

    const normalized = normalizeComplianceIssues(raw);
    expect(normalized).toEqual([
      { category: "must_avoid", snippet: "로톡", reason: "", suggestion: "" },
      { category: "comparison_defamation", snippet: "다른 로펌보다", reason: "비교 금지", suggestion: "일반화" },
    ]);
  });

  it("returns empty array for non-array or non-object entries", () => {
    expect(normalizeComplianceIssues(null)).toEqual([]);
    expect(normalizeComplianceIssues("text")).toEqual([]);
    expect(normalizeComplianceIssues({})).toEqual([]);
    expect(normalizeComplianceIssues([1, 2, 3])).toEqual([]);
  });
});

describe("normalizeComplianceReport", () => {
  it("normalizes Prisma rows into payload shape with defaults", () => {
    const raw = {
      riskScore: undefined,
      summary: null,
      issues: [{ category: "must_avoid", token: "로톡" }],
    };

    const normalized = normalizeComplianceReport(raw);
    expect(normalized).toEqual({
      risk_score: 0,
      summary: "",
      issues: [{ category: "must_avoid", snippet: "로톡", reason: "", suggestion: "" }],
    });
  });
});
