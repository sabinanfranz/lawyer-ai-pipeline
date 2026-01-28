import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse, TopicCandidate } from "@/agents/topicCandidates";
import type { DraftNaverOutput } from "@/agents/draftNaver";
import type { ComplianceRewriteOutput } from "@/agents/complianceRewrite";
import type { Channel } from "@/shared/channel";
import { CHANNEL_ORDER } from "@/shared/channel";
import type {
  ByChannel,
  PartialByChannel,
  Draft as DraftVNext,
  Revised as RevisedVNext,
  ComplianceReport as ComplianceReportVNext,
} from "@/shared/contentTypes.vnext";

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

export type ContentMeta = {
  intake: IntakeInput;
  topic_candidates: TopicCandidatesResponse;
  selected_candidate: TopicCandidate;
};

export type DraftPayload = DraftNaverOutput | DraftVNext;
export type RevisedPayload = { revised_md: string; revised_html: string } | RevisedVNext;
export type ComplianceReportPayload = ComplianceRewriteOutput["report"] | ComplianceReportVNext;

export type ContentRecordMulti = {
  shareId: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  intake: IntakeInput;
  topic_candidates: TopicCandidatesResponse;
  selected_candidate: TopicCandidate;
  drafts: PartialByChannel<DraftPayload>;
  revised?: PartialByChannel<RevisedPayload>;
  compliance_reports?: PartialByChannel<ComplianceReportPayload>;
};

export type CreateDraftsArgs = {
  shareId: string;
  status: ContentStatus;
  createdAt?: string;
  updatedAt?: string;
  intake: IntakeInput;
  topic_candidates: TopicCandidatesResponse;
  selected_candidate: TopicCandidate;
  draftsByChannel: PartialByChannel<DraftPayload>;
};

export interface ContentRepo {
  create(record: ContentRecord): Promise<void>;
  get(shareId: string): Promise<ContentRecord | null>;
  setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null>;

  // v2 multi-channel APIs (Phase 2+)
  createContentWithDrafts(args: CreateDraftsArgs): Promise<void>;
  getByShareIdMulti(shareId: string): Promise<ContentRecordMulti | null>;
  setRevisedByChannel(
    shareId: string,
    channel: Channel,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecordMulti | null>;
}

export const PRIMARY_CHANNEL: Channel = CHANNEL_ORDER[0];
