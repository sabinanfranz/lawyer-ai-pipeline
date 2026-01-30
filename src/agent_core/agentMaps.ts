import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse } from "@/agents/topicCandidates";
import type { ComplianceRewriteOutput } from "@/agents/complianceRewrite";
import type { TopicCandidate } from "@/agents/topicCandidates/schema";
import type { DraftRawV1 } from "@/shared/contentTypes.vnext";

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
  complianceRewrite: import("@/agents/complianceRewrite/schema").ComplianceRewriteInputV1;
};

// Output types (agent result data)
export type AgentOutputMap = {
  topicCandidates: TopicCandidatesResponse;
  draftNaver: DraftRawV1;
  draftLinkedin: DraftRawV1;
  draftThreads: DraftRawV1;
  complianceRewrite: ComplianceRewriteOutput;
};
