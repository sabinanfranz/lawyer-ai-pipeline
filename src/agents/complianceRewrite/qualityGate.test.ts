import { describe, expect, it } from "vitest";
import {
  countCta,
  fixBrokenSpacing,
  normalizeCtaSection,
  normalizeDisclaimer,
  qualityCheck,
} from "./qualityGate";

describe("complianceRewrite quality gate", () => {
  it("deduplicates CTA sections and ensures at least one exists", () => {
    const md = "## CTA\n- call to action\n\n## CTA\n- second";
    const normalized = normalizeCtaSection(md);
    expect(countCta(normalized)).toBe(1);
  });

  it("adds disclaimer if missing", () => {
    const md = "본문입니다.";
    const out = normalizeDisclaimer(md);
    expect(out).toContain("## 디스클레이머");
  });

  it("qualityCheck catches banned expressions and missing CTA/disclaimer", () => {
    const md = "최고 승소 보장\n\n내용";
    const qc = qualityCheck(md);
    expect(qc.ok).toBe(false);
    expect(qc.reasons.length).toBeGreaterThan(0);
  });

  it("fixBrokenSpacing merges split words", () => {
    const md = "계 약서와 디스클 레이머를 확 인하세요.";
    const out = fixBrokenSpacing(md);
    expect(out).toContain("계약서");
    expect(out).toContain("디스클레이머");
    expect(out).toContain("확인");
  });
});
