import type { DraftNaverOutput } from "./schema";

export function fallbackDraftNaver(): DraftNaverOutput {
  return {
    title_candidates: ["(예시) 체크리스트로 정리하는 B2B 리스크", "(예시) 분쟁 초입에서 먼저 확인할 것"],
    body_md: "## (예시) 본문\n\n- 포인트 1\n- 포인트 2\n\n> 디스클레이머: 일반 정보 제공 목적입니다.",
    body_html: "<h2>(예시) 본문</h2><ul><li>포인트 1</li><li>포인트 2</li></ul><p><em>디스클레이머: 일반 정보 제공 목적입니다.</em></p>",
  };
}
