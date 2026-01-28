import { TopicCandidatesAgent } from "@/agents/topicCandidates";
import { DraftNaverAgent } from "@/agents/draftNaver";
import { ComplianceRewriteAgent } from "@/agents/complianceRewrite";
import { DraftLinkedinAgent } from "@/agents/draftLinkedin";
import { DraftThreadsAgent } from "@/agents/draftThreads";
import type { AgentName } from "./agentMaps";
import type { Agent } from "./types";
import type { AgentInputMap, AgentOutputMap } from "./agentMaps";

export const registry = {
  topicCandidates: () => new TopicCandidatesAgent(),
  draftNaver: () => new DraftNaverAgent(),
  draftLinkedin: () => new DraftLinkedinAgent(),
  draftThreads: () => new DraftThreadsAgent(),
  complianceRewrite: () => new ComplianceRewriteAgent(),
} as const;

export function getAgent<N extends AgentName>(name: N): Agent<AgentInputMap[N], AgentOutputMap[N]> {
  return registry[name]() as Agent<AgentInputMap[N], AgentOutputMap[N]>;
}
