import type { DraftRawV1 } from "@/shared/contentTypes.vnext";

const SAFE_TITLES = [
  "(fallback) 5단 스레드로 정리한 핵심 체크포인트",
  "(fallback) 업무 리스크 점검용 Threads 초안",
  "(fallback) 팀 공유용 실무 요약",
];

export function fallbackDraftThreads(): DraftRawV1 {
  const lines = [
    "[1/3] Hook: 지금 프로젝트에서 놓치기 쉬운 리스크를 3단 스레드로 정리했습니다.",
    "[2/3] 리스크·근거: 책임 범위 불명확, 기록 미보관, 일정/비용 변경 시 협의 누락이 반복되면 품질·정산 리스크가 커집니다.",
    "[3/3] 대응·CTA: 통지/변경/검수 절차를 문서화하고 체크리스트로 공유하세요. 자료는 프로필 안내 링크 또는 DM으로 요청해주세요. (직접 URL 금지)",
  ];
  return {
    draft_md: lines.join("\n"),
    title_candidates: SAFE_TITLES,
  };
}
