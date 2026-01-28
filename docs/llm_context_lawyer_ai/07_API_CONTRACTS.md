Last updated: 2026-01-28

# 07_API_CONTRACTS

## 공통 응답 형태
- 성공: `{ ok: true, data }`
- 실패: `{ ok: false, error: { code, message, details, requestId } }`

## 에러 코드
- INVALID_INPUT, NOT_FOUND, AGENT_FAILED, DB_ERROR, INTERNAL

## 엔드포인트

### POST /api/topic-candidates
- 요청: IntakeSchema (industry, target_role, issue_stage, pain_picker[1-2], content_goal, offer_material, pain_sentence?, experience_seed?, must_avoid?)
- 응답: TopicCandidatesResponse (normalized_brief, candidates[7], top3_recommendations[3])

### POST /api/content
- 요청: { intake: IntakeSchema, topic_candidates: TopicCandidatesResponse, selected_candidate: TopicCandidate }
- 처리: DraftNaver/LinkedIn/Threads 3개 draft agent를 병렬 실행(prompt_version=v3) → draft 3건 저장 → shareId 발급
- 응답: { shareId }

### GET /api/content/{shareId}
- 요청: path param shareId
- 응답: ContentRecord (멀티채널 map)
  - `drafts`: { naver, linkedin, threads }
  - `revised?`: Partial map { channel → revised_md/html }
  - `compliance_reports?`: Partial map { channel → risk_score/summary/issues }
  - 레거시 데이터 보호를 위해 누락 채널은 placeholder draft로 채워 반환

### POST /api/content/{shareId}/approve (idempotent)
- 요청: path param shareId
- 처리: 채널별로 ComplianceRewriteAgent를 variant_key=channel로 호출(병렬). `(contentId, channel)`에 revised/report가 이미 있으면 해당 채널은 건너뜀(채널 단위 idempotent). 저장 후 revised 상태는 3채널 모두 존재할 때 revised로 전환.
- 응답: ContentRecord 멀티채널 형태(revised/compliance_reports 맵)
