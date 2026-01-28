import { TopicCandidatesAgent } from "@/agents/topicCandidates";
import { DraftNaverAgent } from "@/agents/draftNaver";
import { ComplianceRewriteAgent } from "@/agents/complianceRewrite";
import { DraftLinkedinAgent } from "@/agents/draftLinkedin";
import { DraftThreadsAgent } from "@/agents/draftThreads";

export const registry = {
  topicCandidates: () => new TopicCandidatesAgent(),
  draftNaver: () => new DraftNaverAgent(),
  draftLinkedin: () => new DraftLinkedinAgent(),
  draftThreads: () => new DraftThreadsAgent(),
  complianceRewrite: () => new ComplianceRewriteAgent(),
} as const;

export type AgentName = keyof typeof registry;
