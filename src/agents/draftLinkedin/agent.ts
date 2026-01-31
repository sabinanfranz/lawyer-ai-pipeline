import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";
import {
  DraftLinkedinLLMResponseSchema,
  type DraftLinkedinLLMResponse,
} from "./schema";
import { fallbackDraftLinkedin } from "./fallback";
import { DRAFT_LOOSE_MODE } from "@/shared/featureFlags.server";
import { coerceDraftRaw } from "@/shared/coerceDraftRaw";
import { runAgentTextWithDebug } from "@/agent_core/textRunner";
import type { DraftRawV1 } from "@/shared/contentTypes.vnext";
import { safeArrayLen, safeStrLen } from "@/shared/safeLen";

const PROMPT_AGENT_KEY = "draft_linkedin";

function normalizeTitleCandidates(rawTitles: unknown, payload: any): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();

  const push = (t?: string) => {
    if (!t || typeof t !== "string") return;
    const v = t.trim();
    if (!v) return;
    if (seen.has(v)) return;
    seen.add(v);
    titles.push(v);
  };

  if (Array.isArray(rawTitles)) {
    rawTitles.forEach((t) => push(t as any));
  }

  const sel = payload?.selected_candidate ?? {};
  push(sel.title_search);
  push(sel.title_share);
  push(sel.primary_keyword);

  const safeTemplates = [
    "실무 리스크 요약과 대응 체크리스트",
    "프로젝트 진행 전 확인해야 할 합의 포인트",
    "팀이 공유할 수 있는 업무 가이드",
  ];
  for (const t of safeTemplates) {
    if (titles.length >= 6) break;
    push(t);
  }

  while (titles.length < 3 && safeTemplates.length > 0) {
    const next = safeTemplates.shift();
    if (next) push(next);
  }

  return titles.slice(0, 6);
}

function buildFinal(llm: DraftLinkedinLLMResponse) {
  const body_md = llm.body_md_lines.join("\n");
  const data: DraftRawV1 = {
    draft_md: body_md,
    title_candidates: llm.title_candidates ?? [],
    raw_json: llm,
  };
  return { data };
}

const FALLBACK_SIGNATURE = JSON.stringify(fallbackDraftLinkedin());

export class DraftLinkedinAgent implements Agent<any, DraftRawV1> {
  name = "draftLinkedin";
  version = "v1";

  async run(input: any, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<DraftRawV1>> {
    const inputForHash = {
      intake: input?.intake,
      selected_candidate: input?.selected_candidate,
      normalized_brief: input?.normalized_brief,
    };
    const canonical = canonicalizeJson(inputForHash);
    const inputHash = sha256(canonical);
    const cacheKey = `${this.name}:${this.version}:${ctx.variant_key}:${ctx.prompt_version}:${ctx.scope_key}:${inputHash}`;

    if (DRAFT_LOOSE_MODE) {
      const { text, agent_debug, cache_key, input_hash, prompt_path } = await runAgentTextWithDebug({
        agent_name: this.name,
        agent_version: this.version,
        variant_key: ctx.variant_key,
        prompt_version: ctx.prompt_version,
        scope_key: ctx.scope_key,
        prompt_agent_key: PROMPT_AGENT_KEY,
        input: inputForHash,
        renderUser: ({ payload_json, prompts }) => renderTemplate(prompts.user, { payload_json }),
        max_tokens_override: 8000,
      });

      const fallback = fallbackDraftLinkedin();
      const coerced = coerceDraftRaw(text, { fallbackDraftMd: fallback.draft_md });

      const titles = normalizeTitleCandidates(coerced.draft.title_candidates ?? [], input);
      const body_md_lines = [coerced.draft.draft_md];
      const { data } = buildFinal({ title_candidates: titles, body_md_lines });

      const used_fallback =
        agent_debug.used_fallback || coerced.parse_mode === "empty" || !text.trim();

      if (!(used_fallback && ctx.llm_mode === "openai")) {
        rt.cache.set(cache_key, data);
      }

      return {
        ok: true,
        data,
        meta: {
          used_fallback,
          cache_hit: agent_debug.cache_hit,
          cache_key,
          input_hash,
          prompt_path,
          parse_mode: coerced.parse_mode,
          output_chars: coerced.output_chars,
        },
      };
    }

    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const cachedDraft = cached as DraftRawV1;
      const cachedFallback = isFallbackResponse(cachedDraft);
      debugLog("DraftLinkedinAgent", `cache_hit=true fallback=${cachedFallback}`);
      return {
        ok: true,
        data: cachedDraft,
        meta: { used_fallback: cachedFallback, cache_hit: true, cache_key: cacheKey, input_hash: inputHash },
      };
    }

    const prompts = await rt.prompts.load({
      agent: PROMPT_AGENT_KEY,
      variant: ctx.variant_key,
      version: ctx.prompt_version,
    });
    const system = prompts.system;
    const user = renderTemplate(prompts.user, { payload_json: canonical });

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[DraftLinkedinAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system?.length ?? 0,
        user_len: user?.length ?? 0,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    if (ctx.llm_mode !== "openai") {
      const data = fallbackDraftLinkedin();
      rt.cache.set(cacheKey, data);
      return {
        ok: true,
        data,
        meta: {
          used_fallback: true,
          cache_hit: false,
          prompt_path: prompts.baseDir,
          cache_key: cacheKey,
          input_hash: inputHash,
        },
      };
    }

    let raw = "";
    try {
      raw = await rt.llm.generateText({
        system,
        user,
        run_id: ctx.run_id,
        max_tokens_override: 8000,
      });
    } catch (e) {
      if (isDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.error("[DraftLinkedinAgent] LLM failed", e);
      }
      const data = fallbackDraftLinkedin();
      debugLog("DraftLinkedinAgent", "skip cache set reason=LLM_ERROR(openai)", { cacheKey, run_id: ctx.run_id });
      return {
        ok: true,
        data,
        meta: {
          used_fallback: true,
          cache_hit: false,
          prompt_path: prompts.baseDir,
          cache_key: cacheKey,
          input_hash: inputHash,
        },
      };
    }

    const baseFallback = fallbackDraftLinkedin();
    const guarded = await jsonGuard<DraftLinkedinLLMResponse>({
      raw,
      schema: DraftLinkedinLLMResponseSchema,
      repair: async ({ raw: badRaw }) => {
        const repairSystem: string = prompts.repair ?? "";
        const repairUser =
          `이전 응답이 JSON 스키마를 만족하지 않습니다. 아래 스키마에 맞는 JSON만 반환하세요.\n\n` +
          `--- BROKEN OUTPUT ---\n${badRaw}\n\n` +
          `--- REQUIRED ---\n` +
          `- title_candidates: string[] (3~6)\n` +
          `- body_md_lines: string[] (각 요소는 한 줄, 최소 10줄)\n`;

        return await rt.llm.generateText({
          system: repairSystem,
          user: repairUser,
          run_id: ctx.run_id,
          max_tokens_override: 8000,
        });
      },
      fallback: () => ({
        title_candidates: baseFallback.title_candidates ?? [],
        body_md_lines: baseFallback.draft_md.split("\n"),
      }),
      maxRepairAttempts: 2,
    });

    const normalizedTitles = normalizeTitleCandidates(guarded.data.title_candidates, input);
    const guardedData: DraftLinkedinLLMResponse = {
      ...guarded.data,
      title_candidates: normalizedTitles,
    };

      const { data } = buildFinal(guardedData);
    if (guarded.used_fallback) {
      debugLog("DraftLinkedinAgent", "fallback reason=JSON_GUARD_FALLBACK");
    }

    if (guarded.used_fallback && ctx.llm_mode === "openai") {
      debugLog("DraftLinkedinAgent", "skip cache set reason=JSON_GUARD_FALLBACK(openai)", {
        cacheKey,
        run_id: ctx.run_id,
        repair_attempts: guarded.repair_attempts,
      });
    } else {
      rt.cache.set(cacheKey, data);
    }

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[DraftLinkedinAgent] output_sizes", {
        run_id: ctx.run_id,
        title_count: safeArrayLen(data.title_candidates),
        md_lines: guardedData.body_md_lines.length,
        body_md_len: safeStrLen(data.draft_md),
        // body_html_len removed: DraftRawV1 does not carry body_html
      });
    }

    return {
      ok: true,
      data,
      meta: {
        used_fallback: guarded.used_fallback,
        cache_hit: false,
        prompt_path: prompts.baseDir,
        cache_key: cacheKey,
        input_hash: inputHash,
        repaired: guarded.repaired,
        repair_attempts: guarded.repair_attempts,
      },
    };
  }
}

function isFallbackResponse(data: DraftRawV1): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
