import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse, TopicCandidate } from "@/agents/topicCandidates";
import type { Channel } from "@/shared/channel";
import { CHANNEL_ORDER } from "@/shared/channel";
import type {
  ByChannel,
  PartialByChannel,
  Draft as DraftVNext,
  Revised as RevisedVNext,
  ComplianceReportPayload,
} from "@/shared/contentTypes.vnext";
import type { DraftRawV1 } from "@/shared/contentTypes.vnext";

export type ContentStatus = "drafted" | "revised";

export type ContentRecord = {
  shareId: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;

  intake: IntakeInput | null;
  topic_candidates: TopicCandidatesResponse | null;
  selected_candidate: TopicCandidate | null;

  draft: DraftVNext;

  revised?: {
    revised_md: string;
    revised_html: string;
  };

  compliance_report?: ComplianceReportPayload;
};

export type ContentMeta = {
  intake: IntakeInput | null;
  topic_candidates: TopicCandidatesResponse | null;
  selected_candidate: TopicCandidate | null;
};

export type DraftPayload = DraftVNext | DraftRawV1;
export type RevisedPayload = { revised_md: string; revised_html: string } | RevisedVNext;
export type { ComplianceReportPayload };

export type ContentRecordMulti = {
  shareId: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  intake: IntakeInput | null;
  topic_candidates: TopicCandidatesResponse | null;
  selected_candidate: TopicCandidate | null;
  drafts: PartialByChannel<DraftPayload>;
  revised?: PartialByChannel<RevisedPayload>;
  compliance_reports?: PartialByChannel<ComplianceReportPayload>;
};

export type CreateDraftsArgs = {
  shareId: string;
  status: ContentStatus;
  createdAt?: string;
  updatedAt?: string;
  intake: IntakeInput | null;
  topic_candidates: TopicCandidatesResponse | null;
  selected_candidate: TopicCandidate | null;
  draftsByChannel: PartialByChannel<DraftPayload>;
  metaByChannel?: PartialByChannel<any>;
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
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"]; meta?: any }
  ): Promise<ContentRecordMulti | null>;
}

export const PRIMARY_CHANNEL: Channel = CHANNEL_ORDER[0];
