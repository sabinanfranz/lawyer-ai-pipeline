import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { DraftThreadsAgent } from "./agent";
import { CacheStore } from "@/agent_core/cacheStore";
import { PromptStore } from "@/agent_core/promptStore";
import { MockLlmClient } from "@/agent_core/llmClient";

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
  it("returns thread with required 3-post prefixes and no banned wording", async () => {
    const agent = new DraftThreadsAgent();
    const res = await agent.run(input, ctx, runtime);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { data } = res;
    const lines = data.body_md.split("\n");
    expect(lines.length).toBe(3);
    const variant = ["[1/3]", "[2/3]", "[3/3]"];
    const hasVariant = variant.every((p) => lines.some((l) => l.startsWith(p)));
    expect(hasVariant).toBe(true);

    const banned = ["전문", "승소율", "무료 상담", "최고"];
    const text = `${data.title_candidates.join(" ")} ${data.body_md}`;
    banned.forEach((b) => expect(text.includes(b)).toBe(false));
  });
});
