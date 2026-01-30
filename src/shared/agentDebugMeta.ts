export type AgentDebugMeta = {
  run_id: string;
  agent_name: string;
  agent_version: string;
  variant_key: string;
  prompt_version: string;
  scope_key: string;
  llm_mode: string;
  cache_hit: boolean;
  used_fallback: boolean;
  repaired: boolean;
  repair_attempts: number;
  latency_ms: number;
  model?: string;
  cache_key_prefix?: string;
  error_kind?: string;
  parse_mode?: string;
  output_chars?: number;
};

export function toMetaAgentDebug(input: Partial<AgentDebugMeta>): AgentDebugMeta {
  return {
    run_id: input.run_id ?? "unknown",
    agent_name: input.agent_name ?? "unknown",
    agent_version: input.agent_version ?? "unknown",
    variant_key: input.variant_key ?? "default",
    prompt_version: input.prompt_version ?? "v0",
    scope_key: input.scope_key ?? "unknown",
    llm_mode: input.llm_mode ?? "unknown",
    cache_hit: !!input.cache_hit,
    used_fallback: !!input.used_fallback,
    repaired: !!input.repaired,
    repair_attempts: Number.isFinite(input.repair_attempts) ? (input.repair_attempts as number) : 0,
    latency_ms: Number.isFinite(input.latency_ms) ? (input.latency_ms as number) : 0,
    model: input.model,
    cache_key_prefix: input.cache_key_prefix,
    error_kind: input.error_kind,
    parse_mode: input.parse_mode,
    output_chars: input.output_chars,
  };
}
