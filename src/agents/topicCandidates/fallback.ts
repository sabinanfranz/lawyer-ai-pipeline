import type { TopicCandidatesResponse } from "./schema";

export function fallbackTopicCandidates(): TopicCandidatesResponse {
  return {
    normalized_brief: {
      persona_summary: "B2B 의사결정자에게 내부 공유될 실무형 법무 콘텐츠 초안",
      pain_summary: "반복되는 운영/계약 리스크를 줄이기 위한 빠른 가이드 필요",
      assumptions: ["사안별로 사실관계는 달라질 수 있음", "최종 발행 전 변호사 검수가 필요함"],
    },
    candidates: Array.from({ length: 7 }).map((_, i) => ({
      id: i + 1,
      title_search: `롱테일 검색형 제목 ${i + 1}`,
      title_share: `내부 공유용 제목 ${i + 1}`,
      smartblock_intent: "info_exploration",
      content_role: "cluster",
      hook: "돈/시간/리스크 관점에서 ‘지금 당장’ 필요한 포인트만 정리합니다.",
      risk_solved: "분쟁 초기 비용과 커뮤니케이션 손실을 줄입니다.",
      format: "guide",
      primary_keyword: "B2B 계약 리스크 점검",
      longtail_keywords: ["외주 계약 체크리스트", "해지 통지 실무", "검수 분쟁 예방"],
      deliverable: "요청 시 내부 점검용 체크리스트(요약본)를 제공합니다.",
      cta_one: "팀에서 바로 써볼 수 있는 점검 질문 리스트가 필요하면 요청해 주세요.",
      difficulty: "중",
      risk_level: "중",
      hitl_points: ["최신 법령/가이드 확인", "업종별 관행/리스크 차이 반영"],
    })),
    top3_recommendations: [
      { id: 1, why: "리드 가능성과 안전성이 균형" },
      { id: 2, why: "클러스터 확장에 유리" },
      { id: 3, why: "작성 난이도 대비 효용이 큼" },
    ],
  };
}
