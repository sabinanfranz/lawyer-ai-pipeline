Last updated: 2026-01-28 (sync)

# 09_TESTING_AND_QA

## 실행
```bash
npm test
```
- Vitest, Node 환경, src/**/*.test.ts 포함

## 현재 테스트(불변식)
1) TopicCandidatesAgent: fallback 계약/길이(7 candidates, top3=3, longtail=3, hitl_points=2, "전문" 금지), 동일 입력 2회 → cache_hit=true
2) jsonGuard: JSON 깨짐 + repair 실패 → fallback 반환
3) ruleScan + deterministic rewrite: 금지어(전문/무료/승소율/전관) 감지·치환
4) InMemoryContentRepo: setRevisedByChannel idempotent(채널별 첫 결과 유지)
5) /api/content 멀티채널: POST 생성 → GET 반환 시 drafts.naver/linkedin/threads 모두 존재
6) /approve 멀티채널: revised/compliance_reports 3채널 생성, 재호출 시 재생성 금지(채널 단위 idempotent)
7) 금지어 주입 후 approve: 각 채널 revised에서 금지어 제거/완곡화, 디스클레이머 포함
8) LLM_MODE=openai + 키 없음 → mock/fallback 경로로도 3채널 유효 스키마 반환
9) DraftThreadsAgent: body_md_lines가 정확히 3줄, `[1/3]~[3/3]` 접두어를 포함하는지 검증
10) normalizeMeta: meta raw가 null/부분/정상일 때 안전히 파싱하여 null 필드로 보전
11) normalizeComplianceWrite: compliance issues/report 저장용 정규화(legacy token/text/message/fix 매핑, 이상치 방어)

## 실패 주입 시나리오
- LLM_MODE=openai + 키 미설정 → fallback으로 drafts/revised가 3채널 모두 유효 스키마 유지
- draft 각 채널에 다른 금지어 삽입 → approve 후 revised에서 전부 제거/완곡화
- approve 중 특정 채널 LLM 오류 → 성공한 채널은 유지되고, 재승인 시 누락 채널만 생성

## 릴리즈 전 체크리스트
- npm test 통과
- /api/content → drafts 3채널 생성/반환 확인
- approve 1회로 revised/report 3채널 생성, 2회 호출해도 재생성 없음
- 금지어/식별단서가 revised에서 제거/완곡화, 디스클레이머 존재
- mock 모드로 /new→/c→approve 흐름 재현(3개 draft/revised 표시)
