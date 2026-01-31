import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";
import {
  DraftThreadsLLMResponseSchema,
  type DraftThreadsLLMResponse,
} from "./schema";
import { fallbackDraftThreads } from "./fallback";
import { DRAFT_LOOSE_MODE } from "@/shared/featureFlags.server";
import { coerceDraftRaw } from "@/shared/coerceDraftRaw";
import { runAgentTextWithDebug } from "@/agent_core/textRunner";
import type { DraftRawV1 } from "@/shared/contentTypes.vnext";
import { safeArrayLen, safeStrLen } from "@/shared/safeLen";

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

function stripThreadsPrefix(s: string): string {
  return s.replace(/^\[\d+\/\d+\]\s*/gm, "").trim();
}

function splitTo3Chunks(text: string): [string, string, string] {
  const t = stripThreadsPrefix(text);
  const parts = t
    .split(/\n\s*\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    const a = parts[0];
    const b = parts[1];
    const c = parts.slice(2).join("\n\n");
    return [a, b, c];
  }

  const one = parts.join("\n\n") || t;
  const s = one.replace(/\s+/g, " ").trim();
  const n = s.length;

  const i = Math.floor(n / 3);
  const j = Math.floor((2 * n) / 3);

  const a = s.slice(0, i).trim() || "요약 1";
  const b = s.slice(i, j).trim() || "요약 2";
  const c = s.slice(j).trim() || "요약 3";
  return [a, b, c];
}

function toThreadsBodyLines(draftMd: string): string[] {
  const [a, b, c] = splitTo3Chunks(draftMd);
  return [`[1/3] ${a}`, `[2/3] ${b}`, `[3/3] ${c}`];
}

function passesThreadShape(lines: string[]): boolean {
  if (!Array.isArray(lines) || lines.length !== 3) return false;
  const required = ["[1/3]", "[2/3]", "[3/3]"];
  const found = new Set<number>();
  lines.forEach((l) => {
    required.forEach((tag, idx) => {
      if (typeof l === "string" && l.trim().startsWith(tag)) found.add(idx);
    });
  });
  return found.size === required.length;
}

function buildFinal(llm: DraftThreadsLLMResponse) {
  const lines = passesThreadShape(llm.body_md_lines)
    ? llm.body_md_lines
    : fallbackDraftThreads().draft_md.split("\n");
  const body_md = lines.join("\n");
  const data: DraftRawV1 = {
    draft_md: body_md,
    title_candidates: llm.title_candidates ?? [],
    raw_json: llm,
  };
  return { data, usedFallbackLines: lines !== llm.body_md_lines };
}

const FALLBACK_SIGNATURE = JSON.stringify(fallbackDraftThreads());

export class DraftThreadsAgent implements Agent<any, DraftRawV1> {
  name = "draftThreads";
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
        max_tokens_override: 4000,
      });

      const fallback = fallbackDraftThreads();
      const coerced = coerceDraftRaw(text, { fallbackDraftMd: fallback.draft_md });

      const titles =
        coerced.draft.title_candidates ?? ["Threads 초안 제목", "대체 제목 1", "대체 제목 2"];
      const body_md_lines = toThreadsBodyLines(coerced.draft.draft_md);
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
      debugLog("DraftThreadsAgent", `cache_hit=true fallback=${cachedFallback}`);
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
      console.log("[DraftThreadsAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system?.length ?? 0,
        user_len: user?.length ?? 0,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    if (ctx.llm_mode !== "openai") {
      const data = fallbackDraftThreads();
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
      const data = fallbackDraftThreads();
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

    const baseFallback = fallbackDraftThreads();
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
          `- body_md_lines: string[] (각 요소는 한 줄, 정확히 3줄, [1/3][2/3][3/3] 접두어)\n`;

        return await rt.llm.generateText({
          system: repairSystem,
          user: repairUser,
          run_id: ctx.run_id,
          max_tokens_override: 4000,
        });
      },
      fallback: () => ({
        title_candidates: baseFallback.title_candidates ?? [],
        body_md_lines: baseFallback.draft_md.split("\n"),
      }),
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
        title_count: safeArrayLen(data.title_candidates),
        md_lines: guardedData.body_md_lines.length,
        body_md_len: safeStrLen(data.draft_md),
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

function isFallbackResponse(data: DraftRawV1): boolean {
  return JSON.stringify(data) === FALLBACK_SIGNATURE;
}
