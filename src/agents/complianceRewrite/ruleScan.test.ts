import crypto from "node:crypto";
import { scanCompliance, applyDeterministicRewrite } from "@/agents/complianceRewrite/ruleScan";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

test("ruleScan detects banned patterns and rewrite removes them", () => {
  const text = "전문 변호사입니다. 무료 상담 가능합니다. 승소율 100%를 보장합니다. 전관 인맥.";
  const scan = scanCompliance({ text, mustAvoidRaw: "전문,무료,승소" });

  expect(scan.issues.length).toBeGreaterThan(0);
  expect(scan.risk_score).toBeGreaterThan(0);

  const rewritten = applyDeterministicRewrite(text, scan.mustAvoidTokens);

  expect(rewritten).not.toContain("전문");
  expect(rewritten).not.toContain("무료");
  expect(rewritten).not.toContain("승소율");
  expect(rewritten).not.toContain("전관");
});
