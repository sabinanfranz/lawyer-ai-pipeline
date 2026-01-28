import type { AgentContext, AgentResult, AgentRuntime } from "./types";
import { CacheStore } from "./cacheStore";
import { PromptStore } from "./promptStore";
import { createLlmClient } from "./llmClient";
import { getAgent } from "./registry";
import { track } from "./telemetry";
import { effectiveLlmMode } from "@/server/env";
import { debugLog } from "./debug";
import { toMetaAgentDebug, type AgentDebugMeta } from "@/shared/agentDebugMeta";
import type { AgentName, AgentInputMap, AgentOutputMap } from "./agentMaps";

type GlobalRt = AgentRuntime;

function getGlobalRuntime(): GlobalRt {
  const g = globalThis as unknown as { __agentRuntime?: GlobalRt };
  if (!g.__agentRuntime) {
    const mode = effectiveLlmMode(); // 키 없으면 mock으로 강등
    g.__agentRuntime = {
      cache: new CacheStore(),
      prompts: new PromptStore(),
      llm: createLlmClient(mode),
    };
  }
  return g.__agentRuntime;
}

export async function runAgent<N extends AgentName>(
  name: N,
  input: AgentInputMap[N],
  overrides?: Partial<Pick<AgentContext, "variant_key" | "prompt_version" | "scope_key">>
): Promise<AgentResult<AgentOutputMap[N]>> {
  const { result } = await runAgentWithDebug(name, input, overrides);
  return result;
}

export async function runAgentWithDebug<N extends AgentName>(
  name: N,
  input: AgentInputMap[N],
  overrides?: Partial<Pick<AgentContext, "variant_key" | "prompt_version" | "scope_key">>
): Promise<{ result: AgentResult<AgentOutputMap[N]>; debug: AgentDebugMeta }> {
  const agent = getAgent(name);
  const rt = getGlobalRuntime();

  const ctx: AgentContext = {
    agent_name: agent.name,
    agent_version: agent.version,
    variant_key: overrides?.variant_key ?? "default",
    prompt_version: overrides?.prompt_version ?? "v1",
    scope_key: overrides?.scope_key ?? "single",
    run_id: crypto.randomUUID(),
    llm_mode: effectiveLlmMode(),
  };

  const start = Date.now();
  debugLog(
    "AGENT_START",
    `${ctx.agent_name} ${ctx.agent_version} ${ctx.variant_key}/${ctx.prompt_version} scope=${ctx.scope_key}`
  );
  track("agent.run.start", { name, ctx });

  const result = await agent.run(input as any, ctx, rt);
  const latency = Date.now() - start;

  track("agent.run.end", {
    name,
    ok: result.ok,
    ms: latency,
    used_fallback: result.meta.used_fallback,
    cache_hit: result.meta.cache_hit,
    repaired: result.meta.repaired,
    repair_attempts: result.meta.repair_attempts,
  });
  debugLog(
    "AGENT_END",
    `${ctx.agent_name} cache_hit=${!!result.meta.cache_hit} used_fallback=${!!result.meta.used_fallback} repaired=${!!result.meta.repaired} latency_ms=${latency}`
  );

  const debug = toMetaAgentDebug({
    run_id: ctx.run_id,
    agent_name: ctx.agent_name,
    agent_version: ctx.agent_version,
    variant_key: ctx.variant_key,
    prompt_version: ctx.prompt_version,
    scope_key: ctx.scope_key,
    llm_mode: ctx.llm_mode,
    cache_hit: !!result.meta.cache_hit,
    used_fallback: !!result.meta.used_fallback,
    repaired: !!result.meta.repaired,
    repair_attempts: result.meta.repair_attempts ?? 0,
    latency_ms: latency,
    cache_key_prefix: (result.meta.cache_key as string | undefined)?.slice(0, 80),
  });

  return { result: result as AgentResult<AgentOutputMap[N]>, debug };
}
