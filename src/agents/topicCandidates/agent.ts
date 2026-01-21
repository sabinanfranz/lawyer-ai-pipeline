import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";

import { fallbackTopicCandidates } from "./fallback";
import { TopicCandidatesResponseSchema, type TopicCandidatesResponse } from "./schema";
import type { IntakeInput } from "@/lib/schemas/intake";

const PROMPT_AGENT_KEY = "topic_candidates";
const FALLBACK_SIGNATURE = JSON.stringify(fallbackTopicCandidates());

export class TopicCandidatesAgent implements Agent<IntakeInput, TopicCandidatesResponse> {
  name = "topicCandidates";
  version = "v1";

  async run(input: IntakeInput, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<TopicCandidatesResponse>> {
    const canonical = canonicalizeJson(input);
    const inputHash = sha256(canonical);

    const cacheKey = `${this.name}:${this.version}:${ctx.variant_key}:${ctx.prompt_version}:${ctx.scope_key}:${inputHash}`;

    // cache hit
    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const v = TopicCandidatesResponseSchema.safeParse(cached);
      if (v.success) {
        const cachedFallback = isFallbackResponse(v.data);
        debugLog("TopicCandidatesAgent", `cache_hit=true fallback=${cachedFallback}`);
        if (cachedFallback) {
          debugLog("TopicCandidatesAgent", "fallback reason=CACHE_HIT_FALLBACK");
        }
        return {
          ok: true,
          data: v.data,
          meta: {
            used_fallback: cachedFallback,
            cache_hit: true,
            cache_key: cacheKey,
            input_hash: inputHash,
          },
        };
      }
      // cache 오염이면 무시하고 진행
    }

    // LLM 사용 불가면 fallback-first (하지만 캐시에 저장)
    if (ctx.llm_mode !== "openai") {
      const data = fallbackTopicCandidates();
      debugLog("TopicCandidatesAgent", "fallback reason=LLM_DISABLED");
      rt.cache.set(cacheKey, data);
      return {
        ok: true,
        data,
        meta: {
          used_fallback: true,
          cache_hit: false,
          cache_key: cacheKey,
          input_hash: inputHash,
        },
      };
    }

    // prompts load
    const prompts = await rt.prompts.load({
      agent: PROMPT_AGENT_KEY,
      variant: ctx.variant_key,
      version: ctx.prompt_version,
    });

    const user = renderTemplate(prompts.user, { payload_json: canonical });
    const system = prompts.system;
    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[TopicCandidatesAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system.length,
        user_len: user.length,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    // LLM call
    let raw = "";
    try {
      raw = await rt.llm.generateText({
        system,
        user,
        run_id: ctx.run_id,
      });
    } catch (e) {
      if (isDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.error("[TopicCandidatesAgent] LLM failed", e);
      }
      const data = fallbackTopicCandidates();
      debugLog("TopicCandidatesAgent", "fallback reason=LLM_ERROR");
      if (ctx.llm_mode !== "openai") {
        rt.cache.set(cacheKey, data);
      } else {
        debugLog("TopicCandidatesAgent", "skip cache set reason=LLM_ERROR(openai)", {
          cacheKey,
          run_id: ctx.run_id,
        });
      }
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

    // JSON guard
    const guarded = await jsonGuard<TopicCandidatesResponse>({
      raw,
      schema: TopicCandidatesResponseSchema,
      repair: async ({ raw: badRaw }) => {
        // repair.txt는 system으로 사용
        const repairSystem = prompts.repair;
        const repairUser =
          `아래 출력은 JSON 스키마를 만족하지 않습니다. 반드시 스키마에 맞는 유효한 JSON만 반환하세요.\n\n` +
          `--- BROKEN OUTPUT ---\n${badRaw}\n\n` +
          `--- REQUIRED ---\n` +
          `- candidates는 정확히 7개\n- top3_recommendations는 정확히 3개\n- 출력은 JSON만\n`;
        if (process.env.DEBUG_AGENT === "1") {
          // eslint-disable-next-line no-console
          console.log("[TopicCandidatesAgent] repair_prompt_sizes", {
            run_id: ctx.run_id,
            system_len: repairSystem.length,
            user_len: repairUser.length,
          });
        }
        return await rt.llm.generateText({ system: repairSystem, user: repairUser, run_id: ctx.run_id });
      },
      fallback: fallbackTopicCandidates,
      maxRepairAttempts: 2,
    });

    const data = guarded.data;
    if (guarded.used_fallback) {
      debugLog("TopicCandidatesAgent", "fallback reason=JSON_GUARD_FALLBACK");
    }
    if (guarded.used_fallback && ctx.llm_mode === "openai") {
      debugLog("TopicCandidatesAgent", "skip cache set reason=JSON_GUARD_FALLBACK(openai)", {
        cacheKey,
        run_id: ctx.run_id,
        repair_attempts: guarded.repair_attempts,
      });
    } else {
      rt.cache.set(cacheKey, data);
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

function isFallbackResponse(data: TopicCandidatesResponse): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
