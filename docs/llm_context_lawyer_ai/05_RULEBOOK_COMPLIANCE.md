Last updated: 2026-01-20

# 05_RULEBOOK_COMPLIANCE

## ruleScan 카테고리 & 가중치
- specialist_wording (30): 전문/전문가/전문변호사/전문팀
- superlative_absolute (12): 최고/유일/No.1/1위/국내 최초/100%/절대/무조건/반드시
- outcome_guarantee (30): 승소율/석방율/성공률/결과 보장/확실히 이김/무조건 승소 등
- free_discount_inducement (25): 무료 상담/상담 무료/할인/특가/염가/최저가
- comparison_defamation (18): 타 로펌/변호사보다, 비교 우위, 더 낫
- influence_suggestion (25): 전관/인맥/연줄/판사·검사 친분 암시
- identifying_details (12): 날짜/금액/지역/회사 식별 단서(서울 등 지역명, ㈜/Inc./LLC/Ltd.)
- must_avoid (5): 사용자 입력 must_avoid 토큰이 본문에 포함된 경우

## Deterministic rewrite 규칙
- “전문” 계열: 전문→전담, 전문 변호사→관련 분야를 주로 취급하는 변호사, 전문가→관련 분야 경험 있는 사람, 전문팀→전담팀
- 최상급/절대: 최고/유일/국내 최초→중요한, No.1/1위→선택 기준 중 하나, 100%→사안별로 달라질 수 있습니다, 절대/무조건/반드시→상황에 따라
- 결과 보장/승소율: 승소율/석방율/성공률→사안별 주요 쟁점, 결과 보장/보장합니다→사안별로 달라질 수 있습니다
- 무료/할인: 무료 상담/상담 무료→자료 요청, 할인/특가/염가/최저가→조건 안내
- 비교/비방: 타 로펌/변호사보다/비교 우위/더 낫→일반적 안내/선택 시 고려 포인트/도움이 될 수 있
- 전관/영향력: 전관/인맥/연줄/판사·검사 친분→절차 이해
- 식별 단서: 금액→구체적 금액, 날짜→특정 시점/연도/월/일자, 지역명→특정 지역, 회사 표기(㈜/Inc./LLC/Ltd./유한회사)→특정 사업자
- must_avoid 토큰: 정규식 이스케이프 후 `(표현 생략)`으로 치환

## Disclaimer 강제
- Markdown: `ensureDisclaimerMd`가 DEFAULT_DISCLAIMER를 하단에 삽입(없으면 추가)
- HTML: `ensureDisclaimerHtml`가 DEFAULT_DISCLAIMER를 `<p>`로 삽입

## Report SSOT
- report(risk_score/issues/summary)는 ruleScan 결과를 그대로 사용 (LLM이 수정 금지)
- LLM 출력은 revised_md/html만 받고, 최종 결과에 deterministic enforcement를 다시 적용하여 금지 표현 재유입을 차단
