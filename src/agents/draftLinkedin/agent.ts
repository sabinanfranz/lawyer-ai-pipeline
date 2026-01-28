import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";
import { mdToHtml } from "@/lib/utils/mdToHtml";
import {
  DraftLinkedinLLMResponseSchema,
  DraftLinkedinResponseSchema,
  type DraftLinkedinLLMResponse,
  type DraftLinkedinResponse,
} from "./schema";
import { fallbackDraftLinkedin } from "./fallback";

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
  const body_html = mdToHtml(body_md);
  const data = DraftLinkedinResponseSchema.parse({
    title_candidates: llm.title_candidates ?? [],
    body_md,
    body_html,
  });
  return { data };
}

const FALLBACK_SIGNATURE = JSON.stringify(buildFinal(fallbackDraftLinkedin()).data);

export class DraftLinkedinAgent implements Agent<any, DraftLinkedinResponse> {
  name = "draftLinkedin";
  version = "v1";

  async run(input: any, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<DraftLinkedinResponse>> {
    const inputForHash = {
      intake: input?.intake,
      selected_candidate: input?.selected_candidate,
      normalized_brief: input?.normalized_brief,
    };
    const canonical = canonicalizeJson(inputForHash);
    const inputHash = sha256(canonical);
    const cacheKey = `${this.name}:${this.version}:${ctx.variant_key}:${ctx.prompt_version}:${ctx.scope_key}:${inputHash}`;

    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const parsed = DraftLinkedinResponseSchema.safeParse(cached);
      if (parsed.success) {
        const cachedFallback = isFallbackResponse(parsed.data);
        debugLog("DraftLinkedinAgent", `cache_hit=true fallback=${cachedFallback}`);
        return {
          ok: true,
          data: parsed.data,
          meta: { used_fallback: cachedFallback, cache_hit: true, cache_key: cacheKey, input_hash: inputHash },
        };
      }
      console.warn("[DraftLinkedinAgent] cache value invalid → ignore", { cacheKey, run_id: ctx.run_id });
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
      const { data } = buildFinal(fallbackDraftLinkedin());
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
      const { data } = buildFinal(fallbackDraftLinkedin());
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

    const guarded = await jsonGuard<DraftLinkedinLLMResponse>({
      raw,
      schema: DraftLinkedinLLMResponseSchema,
      repair: async ({ raw: badRaw }) => {
        const repairSystem = prompts.repair;
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
      fallback: () => fallbackDraftLinkedin(),
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
        title_count: data.title_candidates.length,
        md_lines: guardedData.body_md_lines.length,
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

function isFallbackResponse(data: DraftLinkedinResponse): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
