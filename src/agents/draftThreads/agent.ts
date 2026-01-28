import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";
import { mdToHtml } from "@/lib/utils/mdToHtml";
import {
  DraftThreadsLLMResponseSchema,
  DraftThreadsResponseSchema,
  type DraftThreadsLLMResponse,
  type DraftThreadsResponse,
} from "./schema";
import { fallbackDraftThreads } from "./fallback";

const PROMPT_AGENT_KEY = "draft_threads";

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
    "5단 스레드로 보는 핵심 체크포인트",
    "실무 리스크 요약 및 대응 제안",
    "팀 공유용 간단한 실무 정리",
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

function passesThreadShape(lines: string[]): boolean {
  if (!Array.isArray(lines) || lines.length < 5) return false;
  const required = ["[1/5]", "[2/5]", "[3/5]", "[4/5]", "[5/5]"];
  const found = new Set<number>();
  lines.forEach((l) => {
    required.forEach((tag, idx) => {
      if (typeof l === "string" && l.trim().startsWith(tag)) found.add(idx);
    });
  });
  return found.size === required.length;
}

function buildFinal(llm: DraftThreadsLLMResponse) {
  const lines = passesThreadShape(llm.body_md_lines) ? llm.body_md_lines : fallbackDraftThreads().body_md_lines;
  const body_md = lines.join("\n");
  const body_html = mdToHtml(body_md);
  const data = DraftThreadsResponseSchema.parse({
    title_candidates: llm.title_candidates ?? [],
    body_md,
    body_html,
  });
  return { data, usedFallbackLines: lines !== llm.body_md_lines };
}

const FALLBACK_SIGNATURE = JSON.stringify(buildFinal(fallbackDraftThreads()).data);

export class DraftThreadsAgent implements Agent<any, DraftThreadsResponse> {
  name = "draftThreads";
  version = "v1";

  async run(input: any, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<DraftThreadsResponse>> {
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
      const parsed = DraftThreadsResponseSchema.safeParse(cached);
      if (parsed.success) {
        const cachedFallback = isFallbackResponse(parsed.data);
        debugLog("DraftThreadsAgent", `cache_hit=true fallback=${cachedFallback}`);
        return {
          ok: true,
          data: parsed.data,
          meta: { used_fallback: cachedFallback, cache_hit: true, cache_key: cacheKey, input_hash: inputHash },
        };
      }
      console.warn("[DraftThreadsAgent] cache value invalid → ignore", { cacheKey, run_id: ctx.run_id });
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
      console.log("[DraftThreadsAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system?.length ?? 0,
        user_len: user?.length ?? 0,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    if (ctx.llm_mode !== "openai") {
      const { data } = buildFinal(fallbackDraftThreads());
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
        max_tokens_override: 4000,
      });
    } catch (e) {
      if (isDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.error("[DraftThreadsAgent] LLM failed", e);
      }
      const { data } = buildFinal(fallbackDraftThreads());
      debugLog("DraftThreadsAgent", "skip cache set reason=LLM_ERROR(openai)", { cacheKey, run_id: ctx.run_id });
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

    const guarded = await jsonGuard<DraftThreadsLLMResponse>({
      raw,
      schema: DraftThreadsLLMResponseSchema,
      repair: async ({ raw: badRaw }) => {
        const repairSystem = prompts.repair;
        const repairUser =
          `이전 응답이 JSON 스키마를 만족하지 않습니다. 아래 스키마에 맞는 JSON만 반환하세요.\n\n` +
          `--- BROKEN OUTPUT ---\n${badRaw}\n\n` +
          `--- REQUIRED ---\n` +
          `- title_candidates: string[] (3~6)\n` +
          `- body_md_lines: string[] (각 요소는 한 줄, 최소 5줄, [i/5] 형식 권장)\n`;

        return await rt.llm.generateText({
          system: repairSystem,
          user: repairUser,
          run_id: ctx.run_id,
          max_tokens_override: 4000,
        });
      },
      fallback: () => fallbackDraftThreads(),
      maxRepairAttempts: 2,
    });

    const normalizedTitles = normalizeTitleCandidates(guarded.data.title_candidates, input);
    const guardedData: DraftThreadsLLMResponse = {
      ...guarded.data,
      title_candidates: normalizedTitles,
    };

    const { data, usedFallbackLines } = buildFinal(guardedData);
    if (guarded.used_fallback || usedFallbackLines) {
      debugLog("DraftThreadsAgent", "fallback reason=JSON_GUARD_FALLBACK|shape_guard");
    }

    if ((guarded.used_fallback || usedFallbackLines) && ctx.llm_mode === "openai") {
      debugLog("DraftThreadsAgent", "skip cache set reason=fallback(openai)", {
        cacheKey,
        run_id: ctx.run_id,
        repair_attempts: guarded.repair_attempts,
      });
    } else {
      rt.cache.set(cacheKey, data);
    }

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[DraftThreadsAgent] output_sizes", {
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
        used_fallback: guarded.used_fallback || usedFallbackLines,
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

function isFallbackResponse(data: DraftThreadsResponse): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
