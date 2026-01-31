import { describe, expect, it, vi } from "vitest";
import { DraftLinkedinLLMResponseSchema } from "./schema";
import { fallbackDraftLinkedin } from "./fallback";
import { DraftLinkedinAgent } from "./agent";
import { CacheStore } from "@/agent_core/cacheStore";
import type { AgentRuntime } from "@/agent_core/types";

// 공용 런타임 스텁
const baseRuntime = {
  cache: new CacheStore(),
  prompts: {
    async load() {
      return { system: "sys", user: "user {{payload_json}}", repair: "" };
    },
  },
} as const;

const ctx = {
  agent_name: "draftLinkedin",
  agent_version: "v1",
  variant_key: "default",
  prompt_version: "v1",
  scope_key: "test",
  run_id: "run-test",
  llm_mode: "openai" as const,
};

const minimalInput = {
  intake: {},
  selected_candidate: { title_search: "검색 제목", title_share: "공유 제목" },
  normalized_brief: {},
};

describe("DraftLinkedin title_candidates safety nets", () => {
  it("schema rejects payload when title_candidates is missing", () => {
    const parsed = DraftLinkedinLLMResponseSchema.safeParse({ body_md_lines: ["one line"] });
    expect(parsed.success).toBe(false);
  });

  it("fallbackDraftLinkedin provides title_candidates array", () => {
    const fb = fallbackDraftLinkedin();
    expect(Array.isArray(fb.title_candidates)).toBe(true);
    expect(fb.title_candidates.length).toBeGreaterThan(0);
  });

  it("agent run fills title_candidates even when LLM omits it", async () => {
    const agent = new DraftLinkedinAgent();
    const runtime: AgentRuntime = {
      ...baseRuntime,
      llm: {
        // LLM이 title_candidates를 빼먹는 응답을 반환
        async generateText() {
          return JSON.stringify({ body_md_lines: ["line1", "line2"] });
        },
      },
    };

    const res = await agent.run(minimalInput as any, ctx, runtime);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Array.isArray(res.data.title_candidates)).toBe(true);
    expect(res.data.title_candidates.length).toBeGreaterThan(0);
  });
});
