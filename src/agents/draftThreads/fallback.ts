import type { DraftThreadsLLMResponse } from "./schema";

const SAFE_TITLES = [
  "(fallback) 5단 스레드로 정리한 핵심 체크포인트",
  "(fallback) 업무 리스크 점검용 Threads 초안",
  "(fallback) 팀 공유용 실무 요약",
];

export function fallbackDraftThreads(): DraftThreadsLLMResponse {
  return {
    title_candidates: SAFE_TITLES,
    body_md_lines: [
      "[1/5] Hook: 지금 프로젝트에서 놓치기 쉬운 리스크를 5단 스레드로 정리했습니다.",
      "[2/5] 근거: 관련 규정/계약 조건은 수시로 변동되므로 최신 버전을 확인하세요.",
      "[3/5] 리스크: 책임 범위 불명확, 기록 미보관, 일정/비용 변경 시 협의 누락이 주요 위험입니다.",
      "[4/5] 대응: 역할·서명 권한·변경 절차를 문서로 남기고, 체크리스트로 진행 상황을 공유하세요.",
      "[5/5] CTA: 상세 자료는 프로필의 안내 링크 또는 DM으로 요청해주세요. (직접 URL 삽입 금지)",
    ],
  };
}
