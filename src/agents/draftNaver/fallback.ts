import type { DraftNaverLLMResponse } from "./schema";

export function fallbackDraftNaver(_payload: any): DraftNaverLLMResponse {
  return {
    title_candidates: ["(fallback) 네이버 블로그 초안 제목 1", "(fallback) 제목 2", "(fallback) 제목 3"],
    body_md_lines: [
      "# (fallback) 네이버 블로그 초안",
      "",
      "현재 LLM 응답을 정상적으로 생성하지 못해, 임시 초안을 표시합니다.",
      "",
      "## 체크 포인트",
      "- 입력값이 과도하게 길지 않은지 확인",
      "- 금지 표현(‘전문’, ‘1위’, ‘무료상담’, ‘승소율’ 등)이 포함되지 않았는지 확인",
      "",
      "## 안내",
      "이 글은 일반 정보 제공 목적이며, 구체적 사안은 사실관계에 따라 달라질 수 있습니다.",
    ],
  };
}
