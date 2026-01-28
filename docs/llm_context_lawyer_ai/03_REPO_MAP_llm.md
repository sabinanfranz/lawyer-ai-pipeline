Last updated: 2026-01-27

# 03_REPO_MAP_llm

| 영역 | 경로 |
| --- | --- |
| UI | `src/app/new/page.tsx`, `src/app/c/[shareId]/page.tsx`, `src/components/ui/*`, `src/components/ErrorBanner.tsx` |
| API | `src/app/api/topic-candidates/route.ts`, `src/app/api/content/route.ts`, `src/app/api/content/[shareId]/route.ts`, `src/app/api/content/[shareId]/approve/route.ts` |
| agent_core | `src/agent_core/*` (canonicalize/hash/cache/promptStore/llm/jsonGuard/orchestrator/telemetry/types) |
| agents | `src/agents/topicCandidates/*`, `src/agents/draftNaver/*`, `src/agents/draftLinkedin/*`, `src/agents/draftThreads/*`, `src/agents/complianceRewrite/*` |
| shared (SSOT) | `src/shared/channel.ts`, `src/shared/contentTypes.vnext.ts` |
| repo/db | `src/server/repositories/*`, `src/server/db/prisma.ts`, `prisma/schema.prisma` |
| prompts | `prompts/topic_candidates/default/v1/*`, `prompts/topic_candidates/default/v2/*`, `prompts/draft_naver/default/v1/*`, `prompts/draft_naver/default/v2/*`, `prompts/draft_linkedin/default/v1/*`, `prompts/draft_linkedin/default/v2/*`, `prompts/draft_threads/default/v1/*`, `prompts/draft_threads/default/v2/*`, `prompts/compliance_rewrite/default/v1/*`, `prompts/compliance_rewrite/default/v2/*`, `prompts/compliance_rewrite/naver/v2/*`, `prompts/compliance_rewrite/linkedin/v2/*`, `prompts/compliance_rewrite/threads/v2/*` |
| tests | `src/**/*.test.ts`, `vitest.config.ts` |
