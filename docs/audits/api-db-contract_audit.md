# API–DB Contract Audit (2026-01-28)

## Baseline runs
- `npm ci` — ❌ failed (EACCES unlink in `node_modules/@swc/helpers/.../package.json`); likely pre-existing node_modules owned by different user. Cleanup/reinstall needed before CI.
- `npm run prisma:validate` (Prisma 5.20.0) — ✅ schema valid (matches project dependency).
- `npm run build` — ❌ fails at prerender: `useSearchParams()` must be wrapped in Suspense in `src/app/new/page.tsx` (Next.js message `missing-suspense-with-csr-bailout`). TypeScript phase now passes.

## API Inventory
| Endpoint | Method | Handler file |
| --- | --- | --- |
| `/api/topic-candidates` | POST | `src/app/api/topic-candidates/route.ts` |
| `/api/content` | POST | `src/app/api/content/route.ts` |
| `/api/content/[shareId]` | GET | `src/app/api/content/[shareId]/route.ts` |
| `/api/content/[shareId]/approve` | POST | `src/app/api/content/[shareId]/approve/route.ts` |

## Contract Matrix

### POST /api/topic-candidates
- **Handler**: `src/app/api/topic-candidates/route.ts`
- **Request Payload (SSOT)**: `IntakeSchema` (`src/lib/schemas/intake`)
- **Response Payload (SSOT)**: Intended `TopicCandidatesResponseSchema` (`src/agents/topicCandidates/schema.ts`), but route returns agent output without runtime validation.
- **Repo calls**: none (agent-only).
- **DB models touched**: none.
- **DB→Payload normalization**: N/A.
- **Mismatch/Risk**:
  - Response not parsed/validated; if agent drifts, API could emit invalid shape.
  - No shared export of response type under `src/shared`, so consumers rely on agent schema path.
- **Fix Plan**: parse `result.data` with `TopicCandidatesResponseSchema` before `ok(...)`; optionally export SSOT type to `src/shared` for client/server alignment.

### POST /api/content
- **Handler**: `src/app/api/content/route.ts`
- **Request Payload (SSOT)**: `CreateContentSchema` (intake + topic_candidates + selected_candidate) using shared `IntakeSchema` and `TopicCandidatesResponseSchema`.
- **Response Payload (SSOT)**: `{ shareId: string }` inline; no shared type alias.
- **Repo calls**: `getContentRepo().createContentWithDrafts`.
- **DB models touched**: `Content`, `ContentVersion` (writes drafts for all channels); `ContentVersion.meta` stores snapshot+agent_debug as JSON.
- **DB→Payload normalization**: on read, repo uses `ensureStringArray` for `titleCandidates` and `normalizeComplianceReport`; meta is opaque.
- **Mismatch/Risk**:
  - Request validated, but meta snapshot (intake/topic_candidates/selected_candidate) is written as JSON without runtime guard; if upstream stores malformed meta, future reads may drop record (repo returns null when meta missing).
  - Response type not shared (harder to enforce).
- **Fix Plan**: add meta normalizer in repo (zod-safe) and shared `CreateContentResponse` type; ensure `pickMeta` falls back with validation instead of null-drop.

### GET /api/content/[shareId]
- **Handler**: `src/app/api/content/[shareId]/route.ts`
- **Request Payload (SSOT)**: path param `shareId` (string, unchecked beyond undefined guard).
- **Response Payload (SSOT)**: `ContentRecordMulti` (from `src/server/repositories/contentRepo.ts`) with draft placeholders per channel.
- **Repo calls**: `getContentRepo().getByShareIdMulti`.
- **DB models touched**: `Content`, `ContentVersion` (read), `ComplianceReport` (read).
- **DB→Payload normalization**:
  - Drafts: `ensureStringArray` for `title_candidates`, body strings passthrough, placeholder fills missing drafts.
  - Compliance reports: `normalizeComplianceReport` converts Prisma JSON to payload `{category,snippet,reason,suggestion}`.
  - Meta: `pickMeta` selects first available meta blob; if absent, repo returns `null` → API 404.
- **Mismatch/Risk**:
  - No runtime validation of `meta` content; malformed JSON can cause record drop (404 despite DB presence).
  - Compliance reports per channel may be `undefined`; no placeholder, so clients must null-check.
- **Fix Plan**: validate meta fields against `IntakeSchema`/`TopicCandidatesResponseSchema` before returning; optionally provide empty compliance report map per channel.

### POST /api/content/[shareId]/approve
- **Handler**: `src/app/api/content/[shareId]/approve/route.ts`
- **Request Payload (SSOT)**: path param `shareId`; body none.
- **Response Payload (SSOT)**: `ContentRecordMulti` (same as GET).
- **Repo calls**: `getByShareIdMulti` → `setRevisedByChannel` (writes `ContentVersion` revised + `ComplianceReport`) → `getByShareIdMulti`.
- **DB models touched**: `Content`, `ContentVersion`, `ComplianceReport`.
- **DB→Payload normalization**:
  - Reads normalized via `getByShareIdMulti`.
  - Writes store `report.issues` as provided (assumed validated by agent schema) and meta snapshot; no normalization on write.
- **Mismatch/Risk**:
  - If agent output bypasses schema, DB could store legacy/partial issues; read normalization mitigates but write-side guard absent.
  - No validation of `record.drafts` structure before passing to agent beyond existence; malformed drafts could fail rewrite.
  - Meta snapshot written without validation.
- **Fix Plan**: run `ComplianceRewriteOutputSchema.parse` (or reuse normalizer) on agent result before persisting; add defensive normalize on meta/draft before agent call; add request param zod for `shareId`.

## Top Risks (cross-cutting)
1) Prisma JSON fields (`ContentVersion.meta`, `ComplianceReport.issues`) rely on shape being correct; only compliance reports have read-time normalization. Meta lacks validation → records can vanish via `pickMeta` null check.  
2) Response validation gaps: `/api/topic-candidates` and `/api/content/[shareId]/approve` return agent outputs without runtime parse, risking contract drift.  
3) Tooling drift: `npx prisma validate` defaults to Prisma 7; now pinned via `npm run prisma:validate` (Prisma 5.20.0).  
4) Build currently fails due to `/new` page Suspense requirement (unrelated to DB contract but blocks CI).  
5) `npm ci` permission issue on existing `node_modules` may hide dependency drift; clean install needed before reliable contract tests.

## Next Fix Plan (without schema changes)
1) Add shared payload types (request/response) per endpoint in `src/shared/...` and use them in handlers/repos.  
2) Introduce meta normalizer in `PrismaContentRepo` (validate `intake`, `topic_candidates`, `selected_candidate` with zod; default or throw 500 instead of silent null).  
3) Add runtime `zod` parse for agent outputs in `/api/topic-candidates` and `/api/content/[shareId]/approve`; on failure return `AGENT_FAILED`.  
4) Extend compliance normalization to write path (`setRevisedByChannel` uses `normalizeComplianceReport` before persist).  
5) Add contract tests covering meta normalization and compliance report write/read, plus legacy/invalid cases.  
6) Pin Prisma CLI in scripts (`"prisma:validate": "prisma validate"`) and document using version 5 to avoid CLI 7 config errors.  
7) Resolve `/new` Suspense error to unblock `npm run build` CI gate.
