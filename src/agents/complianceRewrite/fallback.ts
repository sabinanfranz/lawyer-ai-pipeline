import { DEFAULT_DISCLAIMER } from "@/lib/constants/safetyText";
import type { ComplianceRewriteOutput } from "./schema";
import { applyDeterministicRewrite, ensureDisclaimerHtml, ensureDisclaimerMd, scanCompliance } from "./ruleScan";

export function fallbackComplianceRewrite(args: {
  draft_md: string;
  draft_html: string;
  must_avoid?: string;
}): ComplianceRewriteOutput {
  const scan = scanCompliance({ text: args.draft_md, mustAvoidRaw: args.must_avoid });

  const revised_md_base = applyDeterministicRewrite(args.draft_md, scan.mustAvoidTokens);
  const revised_html_base = applyDeterministicRewrite(args.draft_html, scan.mustAvoidTokens);

  const revised_md = ensureDisclaimerMd(revised_md_base, DEFAULT_DISCLAIMER);
  const revised_html = ensureDisclaimerHtml(revised_html_base, DEFAULT_DISCLAIMER);

  const summary =
    scan.issues.length === 0
      ? "광고·윤리 리스크로 볼 수 있는 대표 표현을 뚜렷하게 감지하지 않았습니다. (사안별로 추가 검토가 필요할 수 있습니다.)"
      : `총 ${scan.issues.length}건의 표현을 점검했습니다. 과장/결과보장/유인성/식별 단서 가능 표현은 일반 정보 톤으로 완곡화 또는 일반화하는 방향을 권고합니다.`;

  return {
    revised_md,
    revised_html,
    report: {
      risk_score: scan.risk_score,
      issues: scan.issues,
      summary,
    },
  };
}
