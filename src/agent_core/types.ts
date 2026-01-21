import type { CacheStore } from "./cacheStore";
import type { PromptStore } from "./promptStore";
import type { LlmClient } from "./llmClient";

export type LlmMode = "mock" | "openai";

export type AgentContext = {
  agent_name: string;
  agent_version: string;
  variant_key: string;      // e.g. "default"
  prompt_version: string;   // e.g. "v1"
  scope_key: string;        // e.g. "single" or shareId
  run_id: string;
  llm_mode: LlmMode;        // effective mode
};

export type AgentMeta = {
  used_fallback: boolean;
  cache_hit: boolean;
  prompt_path?: string;

  cache_key?: string;
  input_hash?: string;

  repaired?: boolean;
  repair_attempts?: number;
};

export type AgentResult<T> =
  | { ok: true; data: T; meta: AgentMeta }
  | { ok: false; error: string; meta: AgentMeta };

export type AgentRuntime = {
  cache: CacheStore;
  prompts: PromptStore;
  llm: LlmClient;
};

export interface Agent<Input, Output> {
  name: string;
  version: string;
  run(input: Input, ctx: AgentContext, rt: AgentRuntime): Promise<AgentResult<Output>>;
}
