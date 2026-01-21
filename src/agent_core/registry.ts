import { TopicCandidatesAgent } from "@/agents/topicCandidates";
import { DraftNaverAgent } from "@/agents/draftNaver";
import { ComplianceRewriteAgent } from "@/agents/complianceRewrite";

export const registry = {
  topicCandidates: () => new TopicCandidatesAgent(),
  draftNaver: () => new DraftNaverAgent(),
  complianceRewrite: () => new ComplianceRewriteAgent(),
} as const;

export type AgentName = keyof typeof registry;
