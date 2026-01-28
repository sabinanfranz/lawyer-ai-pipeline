import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { DraftLinkedinAgent } from "./agent";
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
  agent_name: "draftLinkedin",
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

describe("DraftLinkedinAgent fallback (mock mode)", () => {
  it("returns valid schema without banned wording", async () => {
    const agent = new DraftLinkedinAgent();
    const res = await agent.run(input, ctx, runtime);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { data } = res;
    expect(data.title_candidates.length).toBeGreaterThanOrEqual(3);
    expect(data.body_md.length).toBeGreaterThan(10);
    expect(data.body_html.length).toBeGreaterThan(10);

    const banned = ["전문", "승소율", "무료 상담", "최고"];
    const text = `${data.title_candidates.join(" ")} ${data.body_md}`;
    banned.forEach((b) => expect(text.includes(b)).toBe(false));
  });
});
