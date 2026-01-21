Last updated: 2026-01-20

# 09_TESTING_AND_QA

## 실행
```bash
npm test
```
- Vitest, Node 환경, src/**/*.test.ts 포함

## 현재 테스트(불변식)
1) TopicCandidatesAgent fallback 계약/길이(7 candidates, top3=3, longtail=3, hitl_points=2, "전문" 금지)
2) TopicCandidatesAgent 동일 입력 2회 → cache_hit=true
3) jsonGuard: JSON 깨짐 + repair 실패 → fallback 반환
4) ruleScan + deterministic rewrite: 금지어(전문/무료/승소율/전관) 감지하고 치환
5) InMemoryContentRepo.setRevised idempotent: 두 번 호출해도 첫 결과 유지

## 실패 주입 시나리오
- LLM_MODE=openai + 키 미설정 → fallback이 유효 출력 반환
- draft에 금지어 삽입 후 approve → report에 issues, revised에서 금지어 제거 확인

## 릴리즈 전 체크리스트
- npm test 통과
- approve idempotent 유지
- cache hit 동작 확인
- 금지어/식별단서가 revised에서 제거/완곡화
- README 따라 로컬 재현 가능 여부 확인
