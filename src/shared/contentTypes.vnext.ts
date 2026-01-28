// vNext content contracts for upcoming multi-channel support.
// Keeps runtime unchanged while giving future phases stable types.
import type { Channel } from './channel';

export type Draft = {
  title_candidates: string[];
  body_md: string;
  body_html: string;
};

export type Revised = {
  revised_md: string;
  revised_html: string;
};

export type ComplianceIssue = {
  category: string;
  weight: number;
  matches: string[];
};

export type ComplianceReport = {
  risk_score: number;
  summary: string;
  issues: ComplianceIssue[];
};

// Channel-indexed helpers to keep storage/rendering aligned
export type ByChannel<T> = { [K in Channel]: T };
export type PartialByChannel<T> = Partial<ByChannel<T>>;

// vNext ContentRecord shape (to be adopted in later phases)
export type ContentRecordVNext = {
  shareId: string;
  status: 'drafted' | 'revised';
  createdAt: string;
  updatedAt: string;

  intake: unknown;
  topic_candidates: unknown;
  selected_candidate: unknown;

  drafts: ByChannel<Draft>;
  revised?: PartialByChannel<Revised>;
  compliance_reports?: PartialByChannel<ComplianceReport>;
};
