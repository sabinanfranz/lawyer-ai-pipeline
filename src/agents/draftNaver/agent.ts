import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";
import { debugLog, isDebugEnabled } from "@/agent_core/debug";

import { DraftNaverLLMResponseSchema, type DraftNaverLLMResponse } from "./schema";
import { fallbackDraftNaver } from "./fallback";
import { normalizeMdLines } from "./mdNormalize";
import { DRAFT_LOOSE_MODE } from "@/shared/featureFlags.server";
import { coerceDraftRaw } from "@/shared/coerceDraftRaw";
import { runAgentTextWithDebug } from "@/agent_core/textRunner";
import type { DraftRawV1 } from "@/shared/contentTypes.vnext";

const PROMPT_AGENT_KEY = "draft_naver";

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
    for (const t of rawTitles) push(typeof t === "string" ? t : undefined);
  }

  // 보강: payload의 선택된 후보 정보로 채우기
  const sel = payload?.selected_candidate ?? {};
  push(sel.title_search);
  push(sel.title_share);
  push(sel.primary_keyword);

  // 안전 템플릿으로 채우기
  const safeTemplates = [
    "체크리스트로 보는 주요 리스크 점검 포인트",
    "실무자가 바로 쓰는 가이드 핵심 정리",
    "반복되는 실수 줄이는 점검 예시 모음",
  ];
  for (const t of safeTemplates) {
    if (titles.length >= 5) break;
    push(t);
  }

  // 3개 미만일 경우 안전 템플릿으로 채우기
  while (titles.length < 3 && safeTemplates.length > 0) {
    const next = safeTemplates.shift();
    if (next) push(next);
  }

  return titles.slice(0, 5);
}

function preprocessRawTitles(raw: string, payload: any): string {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && "title_candidates" in obj) {
      obj.title_candidates = normalizeTitleCandidates((obj as any).title_candidates, payload);
      return JSON.stringify(obj);
    }
    return raw;
  } catch {
    return raw;
  }
}

function buildFinal(llm: DraftNaverLLMResponse, debug?: { run_id?: string }) {
  const normalizedLines = normalizeMdLines(llm.body_md_lines);
  const body_md = normalizedLines.join("\n");

  if (process.env.DEBUG_AGENT === "1" && debug) {
    const blankCount = normalizedLines.filter((l) => l === "").length;
    const headingCount = normalizedLines.filter((l) => /^#{2,3}\s+/.test(l.trim())).length;
    // eslint-disable-next-line no-console
    console.log("[DraftNaverAgent] md_structure", {
      run_id: debug.run_id,
      lines: normalizedLines.length,
      blank_lines: blankCount,
      headings: headingCount,
      body_md_len: body_md.length,
    });
  }

  const data = {
    draft_md: body_md,
    title_candidates: llm.title_candidates ?? [],
    raw_json: llm,
  } as DraftRawV1;
  return { data, normalizedLines };
}

const FALLBACK_SIGNATURE = JSON.stringify(fallbackDraftNaver({}));

export class DraftNaverAgent implements Agent<any, DraftRawV1> {
  name = "draftNaver";
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

      const fallback = fallbackDraftNaver(input);
      const coerced = coerceDraftRaw(text, {
        fallbackDraftMd: fallback.body_md_lines.join("\n"),
      });

      const titles = normalizeTitleCandidates(coerced.draft.title_candidates ?? [], input);
      const body_md_lines = [coerced.draft.draft_md];
      const { data, normalizedLines } = buildFinal(
        { title_candidates: titles, body_md_lines },
        { run_id: ctx.run_id }
      );

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

    // cache hit (validate shape)
    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const cachedDraft = cached as DraftRawV1;
      const cachedFallback = isFallbackResponse(cachedDraft);
      debugLog("DraftNaverAgent", `cache_hit=true fallback=${cachedFallback}`);
      return {
        ok: true,
        data: cachedDraft,
        meta: {
          used_fallback: cachedFallback,
          cache_hit: true,
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
      const data = fallbackDraftNaver(input);
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
      const data = fallbackDraftNaver(input);
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

    const preprocessedRaw = preprocessRawTitles(raw, input);
    const baseFallback = fallbackDraftNaver(input);
    const guarded = await jsonGuard<DraftNaverLLMResponse>({
      raw: preprocessedRaw,
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
      fallback: () => ({
        title_candidates: baseFallback.title_candidates ?? [],
        body_md_lines: baseFallback.draft_md.split("\n"),
      }),
      maxRepairAttempts: 2,
    });

    const normalizedTitles = normalizeTitleCandidates(guarded.data.title_candidates, input);
    const guardedData: DraftNaverLLMResponse = {
      ...guarded.data,
      title_candidates: normalizedTitles,
    };

    const { data, normalizedLines } = buildFinal(guardedData, { run_id: ctx.run_id });
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
        title_count: data.title_candidates?.length ?? 0,
        md_lines: normalizedLines.length,
        body_md_len: data.draft_md.length,
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
