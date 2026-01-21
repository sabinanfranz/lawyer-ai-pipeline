import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse, TopicCandidate } from "@/agents/topicCandidates";
import type { DraftNaverOutput } from "@/agents/draftNaver";
import type { ComplianceRewriteOutput } from "@/agents/complianceRewrite";

export type ContentStatus = "drafted" | "revised";

export type ContentRecord = {
  shareId: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;

  intake: IntakeInput;
  topic_candidates: TopicCandidatesResponse;
  selected_candidate: TopicCandidate;

  draft: DraftNaverOutput;

  revised?: {
    revised_md: string;
    revised_html: string;
  };

  compliance_report?: ComplianceRewriteOutput["report"];
};

export interface ContentRepo {
  create(record: ContentRecord): Promise<void>;
  get(shareId: string): Promise<ContentRecord | null>;
  setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null>;
}
