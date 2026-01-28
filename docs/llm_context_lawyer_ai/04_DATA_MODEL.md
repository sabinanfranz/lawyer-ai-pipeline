Last updated: 2026-01-28

# 04_DATA_MODEL

## Prisma Schema (요약)
- Enums: `ContentStatus`(drafted|revised), `VersionType`(draft|revised), **`Channel`(naver|linkedin|threads)**
- `contents`: id(cuid), shareId(unique), status, createdAt, updatedAt
- `content_versions`: id, contentId(FK), **channel(Channel, default naver)**, versionType, titleCandidates(json?), bodyMd, bodyHtml, meta(json), createdAt  
  - Unique: `(contentId, channel, versionType)`  
  - Index: `(contentId, channel)`
- `compliance_reports`: id, contentId(FK), **channel(Channel, default naver)**, riskScore, issues(json), summary, createdAt  
  - Unique: `(contentId, channel)`  
  - Index: `(contentId, channel)`
- Backfill: 기존 단일 채널 데이터는 마이그레이션 시 `channel='naver'`로 수렴시킴.
- ContentStatus 의미(선정의): drafted = 3채널 중 하나라도 revised 미존재, revised = 3채널 모두 revised 존재(실제 로직 반영은 Phase 6 예정).

## meta JSON (content_versions.meta)
- `intake`: IntakeInput 스냅샷
- `topic_candidates`: TopicCandidatesResponse 스냅샷
- `selected_candidate`: TopicCandidate 스냅샷
- `agent_debug`: run_id, agent_name/version, variant_key, prompt_version, scope_key, llm_mode, cache_hit, used_fallback, repaired, repair_attempts, latency_ms 등 최소 디버깅 필드(스키마 변경 없이 JSON에 병합)

## GET /api/content/{shareId} 반환 ContentRecord 필드 (멀티채널)
- `shareId`, `status`, `createdAt`, `updatedAt`
- `intake`, `topic_candidates`, `selected_candidate`
- `drafts`: { naver, linkedin, threads } (각 draft는 { title_candidates, body_md, body_html })
- `revised`?: Partial map { channel → { revised_md, revised_html } }
- `compliance_reports`?: Partial map { channel → { risk_score, summary, issues[] } }
  - 레거시/부분 데이터 보호: 채널 draft가 없으면 placeholder를 채워 반환
