import { mdToHtml } from "@/lib/utils/mdToHtml";

const CTA_HEADING = /^#{2,3}\s*CTA\b/i;
const HEADING = /^#{2,3}\s+/;

const BROKEN_SPACING_FIXES: Array<[RegExp, string]> = [
  [/계\s*약\s*서/gi, "계약서"],
  [/확\s*인/gi, "확인"],
  [/디스\s*클\s*레이머/gi, "디스클레이머"],
  [/디스클\s*레이머/gi, "디스클레이머"],
];

const BANNED_PATTERNS: RegExp[] = [
  /(최고|유일|1위|완벽|100%|무조건|반드시)/,
  /(승소\s*보장|무조건\s*이김|책임지고\s*해결)/,
  /(전관|인맥|내부\s*영향력)/,
  /(무료\s*상담|할인|특가|바로\s*문의)/,
];

export function countCta(md: string): number {
  return md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => CTA_HEADING.test(l)).length;
}

export function hasDisclaimer(md: string): boolean {
  return /디스클레이머/i.test(md) || /disclaimer/i.test(md);
}

export function fixBrokenSpacing(md: string): string {
  let out = md;
  for (const [pattern, replacement] of BROKEN_SPACING_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function normalizeCtaSection(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let seenCta = false;
  let skipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isHeading = HEADING.test(trimmed);
    const isCta = CTA_HEADING.test(trimmed);

    if (isCta) {
      if (seenCta) {
        skipping = true;
        continue;
      }
      seenCta = true;
      skipping = false;
      out.push(line);
      continue;
    }

    if (isHeading && skipping) {
      skipping = false;
    }
    if (skipping) continue;

    out.push(line);
  }

  if (!seenCta) {
    if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
    out.push("## CTA");
    out.push("자료를 요청해 주세요. (상담/할인/무료 유도 금지)");
    out.push("이 자료는 내부 점검/검토를 진행하는 실무자에게 유용합니다.");
  }

  return out.join("\n");
}

export function normalizeDisclaimer(md: string): string {
  if (hasDisclaimer(md)) return md;
  const out = md.endsWith("\n") ? md.slice(0, -1) : md;
  return `${out}\n\n## 디스클레이머\n- 이 글은 일반 정보 제공 목적입니다.\n- 사안별로 다를 수 있으니 게시 전 전문가 검토를 권고합니다.`;
}

export function qualityCheck(md: string, opts?: { mustAvoid?: string }): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ctaCount = countCta(md);
  if (ctaCount !== 1) reasons.push(`cta_count=${ctaCount}`);
  if (!hasDisclaimer(md)) reasons.push("missing_disclaimer");

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(md)) {
      reasons.push("banned_expression");
      break;
    }
  }

  const must = (opts?.mustAvoid ?? "").trim();
  if (must) {
    const tokens = must.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    for (const t of tokens) {
      if (!t) continue;
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (re.test(md)) {
        reasons.push("must_avoid_present");
        break;
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function regenerateHtml(md: string, html: string | undefined): string {
  if (!html || html.trim().length < 20) {
    return mdToHtml(md);
  }
  return html;
}
