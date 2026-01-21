import crypto from "node:crypto";
import { TopicCandidatesAgent } from "@/agents/topicCandidates";
import { CacheStore } from "@/agent_core/cacheStore";
import { PromptStore } from "@/agent_core/promptStore";
import { createLlmClient } from "@/agent_core/llmClient";
import type { AgentContext, AgentRuntime } from "@/agent_core/types";
import { sampleIntake } from "@/test/fixtures";

function makeCtx(overrides?: Partial<AgentContext>): AgentContext {
  return {
    agent_name: "topicCandidates",
    agent_version: "v1",
    variant_key: "default",
    prompt_version: "v1",
    scope_key: "single",
    run_id: crypto.randomUUID(),
    llm_mode: "mock",
    ...overrides,
  };
}

function makeRt(): AgentRuntime {
  return {
    cache: new CacheStore(),
    prompts: new PromptStore(),
    llm: createLlmClient("mock"),
  };
}

vi.stubGlobal("crypto", crypto as unknown as Crypto);

describe("TopicCandidatesAgent", () => {
  test("fallback output contract is stable", async () => {
    const agent = new TopicCandidatesAgent();
    const rt = makeRt();
    const ctx = makeCtx({ llm_mode: "mock" });

    const input = sampleIntake();
    const r = await agent.run(input, ctx, rt);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.candidates).toHaveLength(7);
    expect(r.data.top3_recommendations).toHaveLength(3);

    for (const c of r.data.candidates) {
      expect(c.longtail_keywords).toHaveLength(3);
      expect(c.hitl_points).toHaveLength(2);
      expect(JSON.stringify(c)).not.toContain("전문");
    }
  });

  test("cache hit on same input", async () => {
    const agent = new TopicCandidatesAgent();
    const rt = makeRt();
    const input = sampleIntake();

    const r1 = await agent.run(input, makeCtx({ llm_mode: "mock" }), rt);
    expect(r1.ok).toBe(true);

    const r2 = await agent.run(input, makeCtx({ llm_mode: "mock" }), rt);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.meta.cache_hit).toBe(true);
  });
});
