import { expect } from "vitest";

export function expectNonEmptyString(v: unknown, minChars = 1) {
  expect(typeof v).toBe("string");
  expect((v as string).trim().length).toBeGreaterThanOrEqual(minChars);
}

export function expectDraftContract(draft: any, minChars = 1) {
  expect(draft).toBeTruthy();
  expectNonEmptyString(draft.draft_md ?? draft.body_md ?? "", minChars);
  if (draft.title_candidates != null) {
    expect(Array.isArray(draft.title_candidates)).toBe(true);
  }
}

export function expectComplianceReportContract(report: any) {
  expect(report).toBeTruthy();
  expect(typeof report.risk_score).toBe("number");
  expect(report.risk_score).toBeGreaterThanOrEqual(0);
  expect(report.risk_score).toBeLessThanOrEqual(100);
  expectNonEmptyString(report.summary ?? "", 1);
  expect(Array.isArray(report.issues)).toBe(true);
  for (const it of report.issues) {
    expectNonEmptyString(it.category ?? "", 1);
    expectNonEmptyString(it.snippet ?? "", 1);
    expectNonEmptyString(it.reason ?? "", 1);
    expectNonEmptyString(it.suggestion ?? "", 1);
  }
}
