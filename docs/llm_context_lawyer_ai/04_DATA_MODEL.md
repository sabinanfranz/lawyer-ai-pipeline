Last updated: 2026-01-28 (sync)

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
- `intake`: IntakeInput 스냅샷 (없거나 깨지면 null로 정규화)
- `topic_candidates`: TopicCandidatesResponse 스냅샷 (없거나 깨지면 null)
- `selected_candidate`: TopicCandidate 스냅샷 (없거나 깨지면 null)
- `agent_debug`: run_id, agent_name/version, variant_key, prompt_version, scope_key, llm_mode, cache_hit, used_fallback, repaired, repair_attempts, latency_ms 등 최소 디버깅 필드(스키마 변경 없이 JSON에 병합)
- normalizeMeta: meta raw를 safeParse 후 null 필드 채워 반환(어떤 입력도 throw 없음); meta가 깨져도 레코드는 404로 drop되지 않음

## GET /api/content/{shareId} 반환 ContentRecord 필드 (멀티채널)
- `shareId`, `status`, `createdAt`, `updatedAt`
- `intake`, `topic_candidates`, `selected_candidate` (모두 null 가능; meta 파싱 실패해도 record는 반환)
- `drafts`: { naver, linkedin, threads } (각 draft는 { title_candidates, body_md, body_html })
- `revised`?: Partial map { channel → { revised_md, revised_html } }
- `compliance_reports`?: Partial map { channel → { risk_score, summary, issues[] } }
  - compliance_reports는 저장 시점에 `normalizeComplianceReportPayload`로 issues를 `{category,snippet,reason,suggestion}` 표준 4필드로 강제
  - 레거시/부분 데이터 보호: 채널 draft가 없으면 placeholder를 채워 반환
