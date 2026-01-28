// vNext content contracts for upcoming multi-channel support.
// Keeps runtime unchanged while giving future phases stable types.
import type { Channel } from "./channel";

export type Draft = {
  title_candidates: string[];
  body_md: string;
  body_html: string;
};

export type Revised = {
  revised_md: string;
  revised_html: string;
};

// API payload shape for compliance issues (SSOT)
export type ComplianceIssue = {
  category: string;
  snippet: string;
  reason: string;
  suggestion: string;
};

export type ComplianceReport = {
  risk_score: number;
  summary: string;
  issues: ComplianceIssue[];
};

// Channel-indexed helpers to keep storage/rendering aligned
export type ByChannel<T> = { [K in Channel]: T };
export type PartialByChannel<T> = Partial<ByChannel<T>>;

// Placeholders / helpers
export const EMPTY_DRAFT: Draft = {
  title_candidates: [],
  body_md: "",
  body_html: "",
};

export function getDraftOrPlaceholder(
  drafts: PartialByChannel<Draft> | Record<Channel, Draft>,
  ch: Channel
): Draft {
  return (drafts as any)?.[ch] ?? EMPTY_DRAFT;
}

// vNext ContentRecord shape (to be adopted in later phases)
export type ContentRecordVNext = {
  shareId: string;
  status: "drafted" | "revised";
  createdAt: string;
  updatedAt: string;

  intake: unknown;
  topic_candidates: unknown;
  selected_candidate: unknown;

  drafts: ByChannel<Draft>;
  revised?: PartialByChannel<Revised>;
  compliance_reports?: PartialByChannel<ComplianceReport>;
};
