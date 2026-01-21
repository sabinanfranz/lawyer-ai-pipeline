export const INDUSTRY_OPTIONS = [
  "IT/SaaS",
  "제조",
  "커머스/플랫폼",
  "건설/부동산",
  "콘텐츠/미디어",
  "바이오/헬스",
  "금융/핀테크",
  "교육",
  "기타(모름)",
] as const;

export const TARGET_ROLE_OPTIONS = [
  "CEO/대표",
  "HR/인사",
  "CFO/재무",
  "총무/구매",
  "사내변호사/법무팀",
  "CTO/CISO/보안",
  "영업/사업개발",
  "PM/PO",
  "기타",
] as const;

export const ISSUE_STAGE_OPTIONS = ["예방", "진행 중", "사후"] as const;

export const CONTENT_GOAL_OPTIONS = [
  "신뢰 쌓기(초기 리드)",
  "내부 공유용 가이드(팀 교육)",
  "리스크 예방(점검표/체크리스트)",
  "분쟁 대응(초기 대응 매뉴얼)",
] as const;

export const OFFER_MATERIAL_OPTIONS = [
  "체크리스트",
  "FAQ",
  "샘플 문구(서식/조항 예시)",
  "간단 진단표(5문항)",
] as const;

// backwards compatibility aliases
export const INDUSTRIES = INDUSTRY_OPTIONS;
export const TARGET_ROLES = TARGET_ROLE_OPTIONS;
export const ISSUE_STAGES = ISSUE_STAGE_OPTIONS;
export const CONTENT_GOALS = CONTENT_GOAL_OPTIONS;
export const OFFER_MATERIALS = OFFER_MATERIAL_OPTIONS;
