import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse } from "@/agents/topicCandidates";
import type { DraftNaverResponse } from "@/agents/draftNaver";
import type { DraftLinkedinResponse } from "@/agents/draftLinkedin";
import type { DraftThreadsResponse } from "@/agents/draftThreads";
import type { ComplianceRewriteOutput } from "@/agents/complianceRewrite";
import type { TopicCandidate } from "@/agents/topicCandidates/schema";

// Agent name SSOT
export type AgentName =
  | "topicCandidates"
  | "draftNaver"
  | "draftLinkedin"
  | "draftThreads"
  | "complianceRewrite";

// Input types (align with each Agent implementation)
export type AgentInputMap = {
  topicCandidates: IntakeInput;
  draftNaver: {
    intake: IntakeInput;
    selected_candidate: TopicCandidate;
    normalized_brief: unknown;
  };
  draftLinkedin: {
    intake: IntakeInput;
    selected_candidate: TopicCandidate;
    normalized_brief: unknown;
  };
  draftThreads: {
    intake: IntakeInput;
    selected_candidate: TopicCandidate;
    normalized_brief: unknown;
  };
  complianceRewrite: {
    draft: { body_md: string; body_html: string; title_candidates?: string[] };
    must_avoid: string;
  };
};

// Output types (agent result data)
export type AgentOutputMap = {
  topicCandidates: TopicCandidatesResponse;
  draftNaver: DraftNaverResponse;
  draftLinkedin: DraftLinkedinResponse;
  draftThreads: DraftThreadsResponse;
  complianceRewrite: ComplianceRewriteOutput;
};
