import type { ComplianceIssue } from "./schema";

function uniqKey(issue: ComplianceIssue) {
  return `${issue.category}::${issue.snippet}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function parseMustAvoid(raw: string | undefined | null): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  // 쉼표/줄바꿈 기준 1차 분리 후 공백 정리
  const parts = s
    .split(/[,\n]/g)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
  // 너무 많으면 과도 제거 위험 → 상한
  return parts.slice(0, 12);
}

function contextByIndex(text: string, idx: number, span = 140): string {
  if (idx < 0) return text.slice(0, span);
  const start = Math.max(0, text.lastIndexOf("\n", idx) + 1);
  const endNL = text.indexOf("\n", idx);
  const end = endNL === -1 ? text.length : endNL;
  const line = text.slice(start, end).trim();
  if (line.length <= span) return line;
  return line.slice(0, span) + "…";
}

type Rule = {
  category: string;
  weight: number; // risk score add
  re: RegExp;
  reason: string;
  suggestion: string;
};

const RULES: Rule[] = [
  {
    category: "specialist_wording",
    weight: 30,
    re: /전문(가|팀|변호사)?/g,
    reason: "‘전문’ 표기는 등록 여부와 무관하게 광고·윤리 리스크가 될 수 있어 본 워크플로에서는 사용을 금지합니다.",
    suggestion: "‘전담’, ‘주로 취급’, ‘관련 분야 경험’ 등으로 완곡하게 바꿔주세요.",
  },
  {
    category: "superlative_absolute",
    weight: 12,
    re: /(최고|유일|No\.?\s*1|1위|국내\s*최초|100%|절대|무조건|반드시)/g,
    reason: "최상급/절대적 표현은 과장·오인 소지가 있어 광고·윤리 리스크를 높입니다.",
    suggestion: "‘상황에 따라’, ‘일반적으로’, ‘중요한 포인트’처럼 단정하지 않는 표현으로 바꿔주세요.",
  },
  {
    category: "outcome_guarantee",
    weight: 30,
    re: /(승소율|석방율|성공률|결과\s*보장|보장합니다|확실히\s*(이깁니다|승소)|무조건\s*(승소|이깁니다))/g,
    reason: "결과 보장/승소율 등은 부당한 기대를 유발할 수 있어 위험합니다.",
    suggestion: "‘결과를 보장할 수는 없고 사안별로 달라질 수 있습니다’ 톤으로 완곡화하세요.",
  },
  {
    category: "free_discount_inducement",
    weight: 25,
    re: /(무료\s*상담|상담\s*무료|할인|특가|염가|최저가)/g,
    reason: "무료/할인 등 유인성 문구는 광고 규정상 리스크가 있습니다.",
    suggestion: "‘자료 요청’, ‘체크리스트 제공’, ‘자가진단’ 등 마이크로 전환 톤으로 바꾸세요.",
  },
  {
    category: "comparison_defamation",
    weight: 18,
    re: /(다른\s*(로펌|변호사)\s*보다|타\s*(로펌|변호사)\s*보다|비교\s*우위|더\s*낫)/g,
    reason: "타 로펌/변호사 비교·비방은 광고·윤리 리스크가 큽니다.",
    suggestion: "비교 문장을 삭제하고 ‘선택 시 점검 기준’ 형태로 일반화하세요.",
  },
  {
    category: "influence_suggestion",
    weight: 25,
    re: /(전관|인맥|연줄|판사\s*친분|검사\s*친분)/g,
    reason: "전관/영향력 암시는 윤리상 특히 위험한 표현입니다.",
    suggestion: "‘절차 이해’, ‘쟁점 정리’, ‘증거/문서 준비’ 등 실무적 설명으로 대체하세요.",
  },
  {
    category: "identifying_details",
    weight: 12,
    re: /(\d{4}\s*년|\d{1,2}\s*월|\d{1,2}\s*일|\d[\d,]*\s*(원|만원|억원|억|천만|백만)|서울|부산|인천|대구|대전|광주|울산|세종|제주|강남|경기|수원|성남|\(주\)|주식회사|Inc\.|LLC|Ltd\.|유한회사)/g,
    reason: "구체적 날짜/금액/지역/회사 단서는 사건·의뢰인 식별 가능성을 높일 수 있습니다.",
    suggestion: "‘최근/일정 기간/구체적 금액/특정 지역/특정 사업자’처럼 일반화하세요.",
  },
];

export function scanCompliance(args: {
  text: string;
  mustAvoidRaw?: string;
}): { issues: ComplianceIssue[]; risk_score: number; mustAvoidTokens: string[] } {
  const mustAvoidTokens = parseMustAvoid(args.mustAvoidRaw);
  const issues: ComplianceIssue[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const matches = args.text.matchAll(rule.re);
    let count = 0;
    for (const m of matches) {
      const idx = m.index ?? -1;
      const snippet = contextByIndex(args.text, idx);
      const issue: ComplianceIssue = {
        category: rule.category,
        snippet,
        reason: rule.reason,
        suggestion: rule.suggestion,
      };
      const key = uniqKey(issue);
      if (!seen.has(key)) {
        issues.push(issue);
        seen.add(key);
        count++;
      }
      if (count >= 5) break; // 카테고리당 과도한 폭주 방지
    }
  }

  // must_avoid 탐지(사용자 커스텀)
  for (const token of mustAvoidTokens) {
    if (!token) continue;
    if (args.text.includes(token)) {
      const issue: ComplianceIssue = {
        category: "must_avoid",
        snippet: token,
        reason: "사용자가 피하고 싶은 표현(must_avoid)에 포함된 단어가 본문에 등장합니다.",
        suggestion: "해당 표현을 삭제하거나 더 중립적인 표현으로 바꿔주세요.",
      };
      const key = uniqKey(issue);
      if (!seen.has(key)) {
        issues.push(issue);
        seen.add(key);
      }
    }
  }

  // risk score 계산(중복 카테고리 존재 시 1회만 반영)
  const categoryWeights: Record<string, number> = {
    specialist_wording: 30,
    outcome_guarantee: 30,
    free_discount_inducement: 25,
    influence_suggestion: 25,
    comparison_defamation: 18,
    superlative_absolute: 12,
    identifying_details: 12,
    must_avoid: 5,
  };

  const categories = new Set(issues.map((x) => x.category));
  let score = 0;
  for (const c of categories) score += categoryWeights[c] ?? 5;
  score = clamp(score, 0, 100);

  return { issues, risk_score: score, mustAvoidTokens };
}

// --- Deterministic rewrite helpers ---

export function applyDeterministicRewrite(text: string, mustAvoidTokens: string[]): string {
  let out = text;

  // 1) 전문 (무조건 제거/대체)
  out = out.replace(/전문\s*변호사/g, "관련 분야를 주로 취급하는 변호사");
  out = out.replace(/전문\s*팀/g, "전담팀");
  out = out.replace(/전문가/g, "관련 분야 경험이 있는 사람");
  out = out.replace(/전문/g, "전담");

  // 2) 최상급/절대 완곡화
  out = out.replace(/(최고|유일|국내\s*최초)/g, "중요한");
  out = out.replace(/No\.?\s*1|1위/g, "선택 기준 중 하나");
  out = out.replace(/100%/g, "사안별로 달라질 수 있습니다");
  out = out.replace(/(절대|무조건|반드시)/g, "상황에 따라");

  // 3) 결과 보장/승소율 등
  out = out.replace(/승소율|석방율|성공률/g, "사안별 주요 쟁점");
  out = out.replace(/결과\s*보장/g, "결과를 보장할 수는 없지만");
  out = out.replace(/보장합니다/g, "사안별로 달라질 수 있습니다");

  // 4) 무료/할인 등 유인 문구
  out = out.replace(/무료\s*상담|상담\s*무료/g, "자료 요청");
  out = out.replace(/할인|특가|염가|최저가/g, "조건 안내");

  // 5) 비교/비방
  out = out.replace(/다른\s*(로펌|변호사)\s*보다/g, "일반적으로");
  out = out.replace(/타\s*(로펌|변호사)\s*보다/g, "일반적으로");
  out = out.replace(/비교\s*우위/g, "선택 시 고려 포인트");
  out = out.replace(/더\s*낫/g, "도움이 될 수 있");

  // 6) 전관/영향력 암시
  out = out.replace(/전관|인맥|연줄|판사\s*친분|검사\s*친분/g, "절차 이해");

  // 7) 식별 단서 일반화(간단 치환)
  out = out.replace(/\d[\d,]*\s*(원|만원|억원|억|천만|백만)/g, "구체적 금액");
  out = out.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, "특정 시점");
  out = out.replace(/\d{4}\s*년/g, "특정 연도");
  out = out.replace(/\d{1,2}\s*월/g, "특정 월");
  out = out.replace(/\d{1,2}\s*일/g, "특정 일자");
  out = out.replace(/서울|부산|인천|대구|대전|광주|울산|세종|제주|강남|경기|수원|성남/g, "특정 지역");
  out = out.replace(/(주\)|주식회사|Inc\.|LLC|Ltd\.|유한회사)/g, "특정 사업자");

  // 8) must_avoid(사용자 지정) 제거/치환
  for (const t of mustAvoidTokens) {
    if (!t) continue;
    // 너무 공격적인 삭제 방지: 일단 토큰 그대로를 ‘(표현 생략)’으로
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, "(표현 생략)");
  }

  return out;
}

export function ensureDisclaimerMd(md: string, disclaimer: string): string {
  if (md.includes(disclaimer)) return md;
  const trimmed = md.trimEnd();
  return `${trimmed}\n\n---\n\n${disclaimer}\n`;
}

export function ensureDisclaimerHtml(html: string, disclaimer: string): string {
  if (html.includes(disclaimer)) return html;
  const trimmed = html.trimEnd();
  return `${trimmed}\n<p>${disclaimer}</p>\n`;
}
