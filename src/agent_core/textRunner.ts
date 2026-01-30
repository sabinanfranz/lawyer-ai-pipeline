import { canonicalizeJson } from "./canonicalize";
import { sha256 } from "./hash";
import { CacheStore } from "./cacheStore";
import { PromptStore, type PromptBundle } from "./promptStore";
import { createLlmClient } from "./llmClient";
import { debugLog } from "./debug";
import type { AgentRuntime } from "./types";
import { effectiveLlmMode } from "@/server/env";
import { toMetaAgentDebug, type AgentDebugMeta } from "@/shared/agentDebugMeta";

type GlobalRt = AgentRuntime;

function getGlobalRuntime(): GlobalRt {
  const g = globalThis as unknown as { __agentRuntime?: GlobalRt };
  if (!g.__agentRuntime) {
    const mode = effectiveLlmMode();
    g.__agentRuntime = {
      cache: new CacheStore(),
      prompts: new PromptStore(),
      llm: createLlmClient(mode),
    };
  }
  return g.__agentRuntime;
}

export async function runAgentTextWithDebug<TInput>(params: {
  agent_name: string;
  agent_version: string;
  variant_key: string;
  prompt_version: string;
  scope_key: string;
  prompt_agent_key?: string; // default agent_name
  input: TInput;
  renderUser: (args: { payload_json: string; prompts: PromptBundle }) => string;
  max_tokens_override?: number;
}): Promise<{
  text: string;
  agent_debug: AgentDebugMeta;
  cache_key: string;
  input_hash: string;
  prompt_path?: string;
}> {
  const rt = getGlobalRuntime();
  const llm_mode = effectiveLlmMode();
  const run_id = crypto.randomUUID();

  const canonical = canonicalizeJson(params.input);
  const inputHash = sha256(canonical);
  const cacheKey = `${params.agent_name}:${params.agent_version}:${params.variant_key}:${params.prompt_version}:${params.scope_key}:${inputHash}:text`;

  const prompts = await rt.prompts.load({
    agent: params.prompt_agent_key ?? params.agent_name,
    variant: params.variant_key,
    version: params.prompt_version,
  });

  const system = prompts.system;
  const user = params.renderUser({ payload_json: canonical, prompts });

  // cache hit (text)
  const cached = rt.cache.get<string>(cacheKey);
  if (cached) {
    const debug = toMetaAgentDebug({
      run_id,
      agent_name: params.agent_name,
      agent_version: params.agent_version,
      variant_key: params.variant_key,
      prompt_version: params.prompt_version,
      scope_key: params.scope_key,
      llm_mode,
      cache_hit: true,
      used_fallback: false,
      repaired: false,
      repair_attempts: 0,
      latency_ms: 0,
      cache_key_prefix: cacheKey.slice(0, 80),
    });
    return {
      text: cached,
      agent_debug: debug,
      cache_key: cacheKey,
      input_hash: inputHash,
      prompt_path: prompts.baseDir,
    };
  }

  if (llm_mode !== "openai") {
    const debug = toMetaAgentDebug({
      run_id,
      agent_name: params.agent_name,
      agent_version: params.agent_version,
      variant_key: params.variant_key,
      prompt_version: params.prompt_version,
      scope_key: params.scope_key,
      llm_mode,
      cache_hit: false,
      used_fallback: true,
      repaired: false,
      repair_attempts: 0,
      latency_ms: 0,
      cache_key_prefix: cacheKey.slice(0, 80),
      error_kind: "LLM_DISABLED",
    });
    return {
      text: "",
      agent_debug: debug,
      cache_key: cacheKey,
      input_hash: inputHash,
      prompt_path: prompts.baseDir,
    };
  }

  const start = Date.now();
  let text = "";
  try {
    text = await rt.llm.generateText({
      system,
      user,
      run_id,
      max_tokens_override: params.max_tokens_override,
    });
  } catch (e) {
    debugLog("runAgentTextWithDebug", "LLM failed", e);
    const debug = toMetaAgentDebug({
      run_id,
      agent_name: params.agent_name,
      agent_version: params.agent_version,
      variant_key: params.variant_key,
      prompt_version: params.prompt_version,
      scope_key: params.scope_key,
      llm_mode,
      cache_hit: false,
      used_fallback: true,
      repaired: false,
      repair_attempts: 0,
      latency_ms: Date.now() - start,
      cache_key_prefix: cacheKey.slice(0, 80),
      error_kind: "LLM_ERROR",
    });
    return {
      text: "",
      agent_debug: debug,
      cache_key: cacheKey,
      input_hash: inputHash,
      prompt_path: prompts.baseDir,
    };
  }

  const latency = Date.now() - start;
  if (text && text.trim()) {
    rt.cache.set(cacheKey, text);
  }

  const debug = toMetaAgentDebug({
    run_id,
    agent_name: params.agent_name,
    agent_version: params.agent_version,
    variant_key: params.variant_key,
    prompt_version: params.prompt_version,
    scope_key: params.scope_key,
    llm_mode,
    cache_hit: false,
    used_fallback: false,
    repaired: false,
    repair_attempts: 0,
    latency_ms: latency,
    cache_key_prefix: cacheKey.slice(0, 80),
  });

  return {
    text,
    agent_debug: debug,
    cache_key: cacheKey,
    input_hash: inputHash,
    prompt_path: prompts.baseDir,
  };
}
