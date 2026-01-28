Last updated: 2026-01-28

# 06_AGENT_RUNTIME_SSOT

## Agent contracts
- AgentContext: { agent_name, agent_version, variant_key, prompt_version, scope_key, run_id, llm_mode }
- AgentRuntime: { cache: CacheStore, prompts: PromptStore, llm: LlmClient }

## PromptStore
- `load({ agent, variant, version })` → { system, user, repair, baseDir }
- 경로: `prompts/<agent>/<variant>/<version>/*.txt`

## jsonGuard 파이프라인
1) loose parse(JSON 코드펜스/양끝 잘라내기)
2) zod schema validate
3) repair 최대 2회 (LLM 호출)
4) 실패 시 fallback 반환
- 반환: { data, used_fallback, repaired, repair_attempts }

## LLM 모드
- `effectiveLlmMode()`: LLM_MODE=openai + OPENAI_API_KEY 있을 때만 openai, 아니면 mock으로 강등
- MockLlmClient는 항상 오류를 던져 fallback/캐시 경로로 유도
- DEBUG_AGENT=1이면 최초 1회 `LLM_MODE/OPENAI_KEY 존재 여부/effective`를 로그로 남김(mask 처리)
- OpenAI API style: `OPENAI_API_STYLE`(`auto|chat|responses`), 기본 auto는 gpt-5* 계열을 responses API로 라우팅하고 나머지는 chat completions 사용. `X-Client-Request-Id` 헤더에 run_id를 전송.
- Token 설정: chat → `max_completion_tokens`(OPENAI_MAX_COMPLETION_TOKENS), responses → `max_output_tokens`(OPENAI_MAX_OUTPUT_TOKENS), `max_tokens_override`로 per-call 상향 가능.
- 빈 content + finish_reason=length + reasoning_tokens만 소비된 경우 한 번 토큰을 두 배로 높여 재시도.
- DraftNaverAgent는 LLM 출력으로 `title_candidates + body_md_lines`만 받고, 서버에서 `body_md_lines.join("\n")` 후 `mdToHtml`로 HTML을 결정적으로 생성해 저장/노출함(LLM HTML 미사용).
- DraftLinkedin/DraftThreads/Naver draft 호출은 기본적으로 prompt_version=v3을 사용한다.
- DraftThreadsAgent 출력 스키마: `title_candidates` 3~6개, `body_md_lines`는 정확히 3줄이며 각 줄이 `[1/3] …`, `[2/3] …`, `[3/3] …` 접두어로 시작해야 한다. 접두어/줄 수가 어긋나면 3줄 fallback으로 대체된다.

## 캐시
- 전역 in-memory `CacheStore` (HMR에서도 유지 시도)
- key = `agent:version:variant:prompt_version:scope:input_hash`
- CacheStore 자체는 dumb(정책 없음); 에이전트 내부에서 openai 모드 fallback 결과는 캐시 금지 규칙을 적용

## Orchestrator(runAgent)
- 글로벌 runtime 초기화(cache/prompts/llm)
- AgentContext 구성 후 agent.run 호출
- telemetry: DEBUG_AGENT=1이면 콘솔 로깅
  - AGENT_START/END: agent_name/version, variant/prompt_version, scope, cache_hit/used_fallback/repaired, latency
  - CACHE: hit/miss/set(키 앞 80자)
  - LLM_CALL/ERR: model/base_url/timeout/max_tokens/temperature/run_id, HTTP status/message 포함
  - JSON_GUARD: parse/schema 결과, repair 시도, fallback 여부

## Fallback 캐시 정책(openai 모드)
- openai 모드에서 LLM 호출 실패(LLM_ERROR)나 jsonGuard fallback(JSON_GUARD_FALLBACK) 결과는 캐시하지 않음
  - 적용: TopicCandidatesAgent, DraftNaverAgent, ComplianceRewriteAgent
  - mock/비-openai 모드에서는 fallback 결과를 캐시(개발 편의)
