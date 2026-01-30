import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { DraftThreadsAgent } from "./agent";
import { CacheStore } from "@/agent_core/cacheStore";
import { PromptStore } from "@/agent_core/promptStore";
import { MockLlmClient } from "@/agent_core/llmClient";
import { expectDraftContract } from "@/test/assertions";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

const runtime = {
  cache: new CacheStore(),
  prompts: new PromptStore(),
  llm: new MockLlmClient(),
};

const ctx = {
  agent_name: "draftThreads",
  agent_version: "v1",
  variant_key: "default",
  prompt_version: "v1",
  scope_key: "test",
  run_id: "run-test",
  llm_mode: "mock" as const,
};

const input = {
  intake: { any: "data" } as any,
  selected_candidate: { title_search: "검색 제목", title_share: "공유 제목" } as any,
  normalized_brief: {},
};

describe("DraftThreadsAgent fallback (mock mode)", () => {
  it("returns DraftRawV1 contract (draft_md non-empty)", async () => {
    const agent = new DraftThreadsAgent();
    const res = await agent.run(input, ctx, runtime);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expectDraftContract(res.data, 5);
  });
});
