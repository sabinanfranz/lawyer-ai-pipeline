Last updated: 2026-01-20

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
- 처리: DraftNaverAgent 실행 → repo.create → shareId 발급
- 응답: { shareId }

### GET /api/content/{shareId}
- 요청: path param shareId
- 응답: ContentRecord (draft + optional revised/compliance_report)

### POST /api/content/{shareId}/approve (idempotent)
- 요청: path param shareId
- 처리: 이미 revised/report 있으면 재생성 금지. 없으면 ComplianceRewriteAgent 실행 → repo.setRevised
- 응답: ContentRecord (revised+report 포함)
