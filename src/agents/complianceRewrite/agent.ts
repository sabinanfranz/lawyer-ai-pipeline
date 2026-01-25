import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { canonicalizeJson, sha256 } from "@/agent_core";
import { jsonGuard } from "@/agent_core/jsonGuard";
import { renderTemplate } from "@/agent_core/promptStore";

import { DraftNaverOutputSchema } from "@/agents/draftNaver/schema";
import type { DraftNaverOutput } from "@/agents/draftNaver/schema";

import {
  ComplianceRewriteLlmSchema,
  ComplianceRewriteOutputSchema,
  type ComplianceRewriteLlmOutput,
  type ComplianceRewriteOutput,
} from "./schema";
import { fallbackComplianceRewrite } from "./fallback";
import { applyDeterministicRewrite, ensureDisclaimerHtml, ensureDisclaimerMd, scanCompliance } from "./ruleScan";
import { DEFAULT_DISCLAIMER } from "@/lib/constants/safetyText";
import { z } from "zod";
import {
  fixBrokenSpacing,
  normalizeCtaSection,
  normalizeDisclaimer,
  qualityCheck,
  regenerateHtml,
} from "./qualityGate";

const PROMPT_AGENT_KEY = "compliance_rewrite";

const ComplianceRewriteInputSchema = z.object({
  draft: DraftNaverOutputSchema,
  must_avoid: z.string().optional().default(""),
});

export type ComplianceRewriteInput = z.infer<typeof ComplianceRewriteInputSchema>;

export class ComplianceRewriteAgent implements Agent<ComplianceRewriteInput, ComplianceRewriteOutput> {
  name = "complianceRewrite";
  version = "v1";

  async run(inputRaw: ComplianceRewriteInput, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<ComplianceRewriteOutput>> {
    const parsed = ComplianceRewriteInputSchema.safeParse(inputRaw);
    if (!parsed.success) {
      const fb = fallbackComplianceRewrite({
        draft_md: "",
        draft_html: "",
        must_avoid: "",
      });
      return { ok: true, data: fb, meta: { used_fallback: true, cache_hit: false } };
    }

    const input = parsed.data;
    const draft: DraftNaverOutput = input.draft;

    const canonical = canonicalizeJson({
      draft_md: draft.body_md,
      draft_html: draft.body_html,
      must_avoid: input.must_avoid ?? "",
      variant: ctx.variant_key,
      prompt_version: ctx.prompt_version,
    });
    const inputHash = sha256(canonical);
    const cacheKey = `${this.name}:${this.version}:${ctx.variant_key}:${ctx.prompt_version}:${ctx.scope_key}:${inputHash}`;

    // cache hit
    const cached = rt.cache.get<unknown>(cacheKey);
    if (cached) {
      const parsedCached = ComplianceRewriteOutputSchema.safeParse(cached);
      if (parsedCached.success) {
        return {
          ok: true,
          data: parsedCached.data,
          meta: { used_fallback: false, cache_hit: true, cache_key: cacheKey, input_hash: inputHash },
        };
      }
      console.warn("[ComplianceRewriteAgent] cache value invalid → ignore", { cacheKey, run_id: ctx.run_id });
    }

    // 1) Facts Builder (SSOT)
    const scan = scanCompliance({ text: draft.body_md, mustAvoidRaw: input.must_avoid });
    const report = {
      risk_score: scan.risk_score,
      issues: scan.issues,
      summary:
        scan.issues.length === 0
          ? "대표적인 광고·윤리 리스크 표현을 뚜렷하게 감지하지 않았습니다. 다만 사안별로 추가 검토가 필요할 수 있습니다."
          : `총 ${scan.issues.length}건을 감지했습니다. 과장/결과보장/유인성/식별 단서 가능 표현을 일반 정보 톤으로 완곡화·일반화하는 방향을 권고합니다.`,
    } as const;

    // 2) fallback baseline(항상 가능)
    const fallbackOut = fallbackComplianceRewrite({
      draft_md: draft.body_md,
      draft_html: draft.body_html,
      must_avoid: input.must_avoid,
    });

    // LLM 불가 → fallback 확정
    if (ctx.llm_mode !== "openai") {
      rt.cache.set(cacheKey, fallbackOut);
      return {
        ok: true,
        data: fallbackOut,
        meta: { used_fallback: true, cache_hit: false, cache_key: cacheKey, input_hash: inputHash },
      };
    }

    // 3) LLM 보조(Rewrite만) + JSON Guard
    const prompts = await rt.prompts.load({
      agent: PROMPT_AGENT_KEY,
      variant: ctx.variant_key,
      version: ctx.prompt_version,
    });

    const user = renderTemplate(prompts.user, {
      must_avoid: (input.must_avoid ?? "").trim(),
      issues_json: JSON.stringify(report.issues),
      disclaimer_text: DEFAULT_DISCLAIMER,
      draft_md: draft.body_md,
      draft_html: draft.body_html,
    });
    const system = prompts.system;

    if (process.env.DEBUG_AGENT === "1") {
      // eslint-disable-next-line no-console
      console.log("[ComplianceRewriteAgent] prompt_sizes", {
        run_id: ctx.run_id,
        system_len: system?.length ?? 0,
        user_len: user?.length ?? 0,
        repair_system_len: prompts.repair?.length ?? 0,
      });
    }

    let raw = "";
    try {
      raw = await rt.llm.generateText({
        system,
        user,
        run_id: ctx.run_id,
        max_tokens_override: 6000,
      });
    } catch {
      // LLM 호출 실패 → fallback
      if (ctx.llm_mode !== "openai") {
        rt.cache.set(cacheKey, fallbackOut);
      } else {
        console.warn("[ComplianceRewriteAgent] LLM_ERROR → skip cache set", {
          cacheKey,
          run_id: ctx.run_id,
        });
      }
      return {
        ok: true,
        data: fallbackOut,
        meta: {
          used_fallback: true,
          cache_hit: false,
          prompt_path: prompts.baseDir,
          cache_key: cacheKey,
          input_hash: inputHash,
        },
      };
    }

    const guarded = await jsonGuard<ComplianceRewriteLlmOutput>({
      raw,
      schema: ComplianceRewriteLlmSchema,
      repair: async ({ raw: badRaw }) => {
        const repairUser =
          `아래 출력은 JSON 스키마를 만족하지 않습니다. 반드시 유효한 JSON만 반환하세요.\n\n` +
          `--- BROKEN OUTPUT ---\n${badRaw}\n\n` +
          `--- REQUIRED SCHEMA ---\n{ "revised_md": "...", "revised_html": "..." }\n`;
        if (process.env.DEBUG_AGENT === "1") {
          // eslint-disable-next-line no-console
          console.log("[ComplianceRewriteAgent] repair_prompt_sizes", {
            run_id: ctx.run_id,
            system_len: prompts.repair?.length ?? 0,
            user_len: repairUser.length,
          });
        }
        return await rt.llm.generateText({
          system: prompts.repair,
          user: repairUser,
          run_id: ctx.run_id,
          max_tokens_override: 6000,
        });
      },
      fallback: () => ({ revised_md: fallbackOut.revised_md, revised_html: fallbackOut.revised_html }),
      maxRepairAttempts: 2,
    });

    // 4) Deterministic enforcement(재유입 차단) + quality gate
    let revised_md = ensureDisclaimerMd(
      applyDeterministicRewrite(guarded.data.revised_md, scan.mustAvoidTokens),
      DEFAULT_DISCLAIMER
    );
    let revised_html = ensureDisclaimerHtml(
      applyDeterministicRewrite(guarded.data.revised_html, scan.mustAvoidTokens),
      DEFAULT_DISCLAIMER
    );

    revised_md = fixBrokenSpacing(revised_md);
    revised_md = normalizeCtaSection(revised_md);
    revised_md = normalizeDisclaimer(revised_md);
    revised_html = regenerateHtml(revised_md, revised_html);

    const qc = qualityCheck(revised_md, { mustAvoid: input.must_avoid });
    let finalOut: ComplianceRewriteOutput = {
      revised_md,
      revised_html,
      report: {
        risk_score: report.risk_score,
        issues: report.issues,
        summary: report.summary,
      },
    };

    let usedFallback = guarded.used_fallback;
    if (!qc.ok) {
      console.warn("[ComplianceRewriteAgent] quality_gate_fail → fallback", { run_id: ctx.run_id, reasons: qc.reasons });
      finalOut = fallbackOut;
      usedFallback = true;
    }

    if (usedFallback && ctx.llm_mode === "openai") {
      console.warn("[ComplianceRewriteAgent] skip cache set reason=fallback", {
        cacheKey,
        run_id: ctx.run_id,
        repair_attempts: guarded.repair_attempts,
      });
    } else {
      rt.cache.set(cacheKey, finalOut);
    }

    return {
      ok: true,
      data: finalOut,
      meta: {
        used_fallback: usedFallback,
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
