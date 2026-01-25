import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";

import {
  DraftNaverLLMResponseSchema,
  DraftNaverResponseSchema,
  type DraftNaverLLMResponse,
  type DraftNaverResponse,
} from "./schema";
import { fallbackDraftNaver } from "./fallback";
import { mdToHtml } from "@/lib/utils/mdToHtml";

const PROMPT_AGENT_KEY = "draft_naver";

function toFinal(llm: DraftNaverLLMResponse): DraftNaverResponse {
  const body_md = (llm.body_md_lines ?? []).join("\n");
  const body_html = mdToHtml(body_md);
  return DraftNaverResponseSchema.parse({
    title_candidates: llm.title_candidates ?? [],
    body_md,
    body_html,
  });
}

const FALLBACK_SIGNATURE = JSON.stringify(toFinal(fallbackDraftNaver({})));

export class DraftNaverAgent implements Agent<any, DraftNaverResponse> {
  name = "draftNaver";
  version = "v1";

  async run(input: any, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<DraftNaverResponse>> {
    const inputForHash = {
      intake: input?.intake,
      selected_candidate: input?.selected_candidate,
      normalized_brief: input?.normalized_brief,
    };
    const canonical = canonicalizeJson(inputForHash);
    const inputHash = sha256(canonical);
    const cacheKey = `${this.name}:${this.version}:${ctx.variant_key}:${ctx.prompt_version}:${ctx.scope_key}:${inputHash}`;

    // cache hit (validate shape)
    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const parsed = DraftNaverResponseSchema.safeParse(cached);
      if (parsed.success) {
        const cachedFallback = isFallbackResponse(parsed.data);
        debugLog("DraftNaverAgent", `cache_hit=true fallback=${cachedFallback}`);
        return {
          ok: true,
          data: parsed.data,
          meta: {
            used_fallback: cachedFallback,
            cache_hit: true,
            cache_key: cacheKey,
            input_hash: inputHash,
          },
        };
      }
      console.warn("[DraftNaverAgent] cache value invalid → ignore", { cacheKey, run_id: ctx.run_id });
    }

    // prompts load
    const prompts = await rt.prompts.load({
      agent: PROMPT_AGENT_KEY,
      variant: ctx.variant_key,
      version: ctx.prompt_version,
    });
    const system = prompts.system;
    const user = renderTemplate(prompts.user, { payload_json: canonical });

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[DraftNaverAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system?.length ?? 0,
        user_len: user?.length ?? 0,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    // mock / non-openai → fallback but cache OK
    if (ctx.llm_mode !== "openai") {
      const data = toFinal(fallbackDraftNaver(input));
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

    // LLM call
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
        console.error("[DraftNaverAgent] LLM failed", e);
      }
      const data = toFinal(fallbackDraftNaver(input));
      debugLog("DraftNaverAgent", "skip cache set reason=LLM_ERROR(openai)", { cacheKey, run_id: ctx.run_id });
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

    const guarded = await jsonGuard<DraftNaverLLMResponse>({
      raw,
      schema: DraftNaverLLMResponseSchema,
      repair: async ({ raw: badRaw }) => {
        const repairSystem = prompts.repair;
        const repairUser =
          `아래 출력은 JSON 스키마를 만족하지 않습니다. 반드시 스키마에 맞는 유효한 JSON만 반환하세요.\n\n` +
          `--- BROKEN OUTPUT ---\n${badRaw}\n\n` +
          `--- REQUIRED ---\n` +
          `- 출력은 JSON만 (설명/코드펜스 금지)\n` +
          `- title_candidates: string[]\n` +
          `- body_md_lines: string[] (각 요소는 "한 줄", \\n 포함 금지)\n`;

        if (process.env.DEBUG_AGENT === "1") {
          // eslint-disable-next-line no-console
          console.log("[DraftNaverAgent] repair_prompt_sizes", {
            run_id: ctx.run_id,
            system_len: repairSystem?.length ?? 0,
            user_len: repairUser.length,
          });
        }

        return await rt.llm.generateText({
          system: repairSystem,
          user: repairUser,
          run_id: ctx.run_id,
          max_tokens_override: 8000,
        });
      },
      fallback: () => fallbackDraftNaver(input),
      maxRepairAttempts: 2,
    });

    const data = toFinal(guarded.data);
    if (guarded.used_fallback) {
      debugLog("DraftNaverAgent", "fallback reason=JSON_GUARD_FALLBACK");
    }

    if (guarded.used_fallback && ctx.llm_mode === "openai") {
      debugLog("DraftNaverAgent", "skip cache set reason=JSON_GUARD_FALLBACK(openai)", {
        cacheKey,
        run_id: ctx.run_id,
        repair_attempts: guarded.repair_attempts,
      });
    } else {
      rt.cache.set(cacheKey, data);
    }

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[DraftNaverAgent] output_sizes", {
        run_id: ctx.run_id,
        title_count: data.title_candidates.length,
        md_lines: guarded.data.body_md_lines?.length ?? 0,
        body_md_len: data.body_md.length,
        body_html_len: data.body_html.length,
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

function isFallbackResponse(data: DraftNaverResponse): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
