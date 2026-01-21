Last updated: 2026-01-20

# 04_DATA_MODEL

## Prisma Schema (요약)
- Enums: `ContentStatus`(drafted|revised), `VersionType`(draft|revised)
- `contents`: id(cuid), shareId(unique), status, createdAt, updatedAt
- `content_versions`: id, contentId(FK), versionType, titleCandidates(json?), bodyMd, bodyHtml, meta(json), createdAt
- `compliance_reports`: id, contentId(unique FK), riskScore, issues(json), summary, createdAt

## meta JSON (content_versions.meta)
- `intake`: IntakeInput 스냅샷
- `topic_candidates`: TopicCandidatesResponse 스냅샷
- `selected_candidate`: TopicCandidate 스냅샷

## GET /api/content/{shareId} 반환 ContentRecord 필드
- `shareId`, `status`, `createdAt`, `updatedAt`
- `intake`, `topic_candidates`, `selected_candidate`
- `draft`: { title_candidates, body_md, body_html }
- `revised`?: { revised_md, revised_html }
- `compliance_report`?: { risk_score, summary, issues[] }
