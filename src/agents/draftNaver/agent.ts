import type { Agent, AgentContext, AgentResult, AgentRuntime } from "@/agent_core";
import { fallbackDraftNaver } from "./fallback";
import type { DraftNaverOutput } from "./schema";
import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidate, NormalizedBrief } from "@/agents/topicCandidates/schema";

export type DraftNaverInput = {
  intake: IntakeInput;
  selected_candidate: TopicCandidate;
  normalized_brief: NormalizedBrief;
};

// Cache policy (must keep):
// In openai mode, NEVER cache fallback results caused by:
// - LLM_ERROR (timeout/network/429/etc)
// - JSON_GUARD_FALLBACK (schema/repair failure)
// CacheStore stays dumb; enforce this inside DraftNaverAgent.run().
export class DraftNaverAgent implements Agent<DraftNaverInput, DraftNaverOutput> {
  name = "draftNaver";
  version = "v1";

  async run(_input: DraftNaverInput, _ctx: AgentContext, _rt: AgentRuntime): Promise<AgentResult<DraftNaverOutput>> {
    const data = fallbackDraftNaver();
    return { ok: true, data, meta: { used_fallback: true, cache_hit: false } };
  }
}
