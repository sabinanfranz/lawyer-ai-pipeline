// vNext content contracts for upcoming multi-channel support.
// Keeps runtime unchanged while giving future phases stable types.
import { z } from "zod";
import type { Channel } from "./channel";

export type Draft = {
  // Primary (SSOT)
  draft_md: string;
  title_candidates?: string[];
  body_html?: string | null;

  // Legacy compatibility (PR-3까지 유지)
  body_md?: string;
  body_md_lines?: string[];
};

export const DraftViewV1Schema = z.object({
  draft_md: z.string().min(0),
  title_candidates: z.array(z.string()).optional(),
  body_html: z.string().nullable().optional(),

  // legacy aliases (deprecated)
  body_md: z.string().optional(),
  body_md_lines: z.array(z.string()).optional(),
});

export type DraftViewV1 = z.infer<typeof DraftViewV1Schema>;

export type Revised = {
  revised_md: string;
  revised_html: string;
};

// DraftRawV1: Draft "느슨한" 출력 표준(향후 DRAFT_LOOSE_MODE에서 사용)
// PR-0에서는 정의만 추가하고 아직 사용하지 않는다.
export const DraftRawV1Schema = z
  .object({
    draft_md: z.string().min(1, "draft_md must be non-empty"),
    title_candidates: z.array(z.string()).optional(),
    raw_json: z.unknown().optional(),
  })
  .strict();

export type DraftRawV1 = z.infer<typeof DraftRawV1Schema>;

// API payload shape for compliance issues (SSOT)
export type ComplianceIssuePayload = {
  category: string;
  snippet: string;
  reason: string;
  suggestion: string;
};

export type ComplianceReportPayload = {
  risk_score: number;
  summary: string;
  issues: ComplianceIssuePayload[];
};

// Backward-friendly aliases (avoid downstream churn)
export type ComplianceIssue = ComplianceIssuePayload;
export type ComplianceReport = ComplianceReportPayload;

// Channel-indexed helpers to keep storage/rendering aligned
export type ByChannel<T> = { [K in Channel]: T };
export type PartialByChannel<T> = Partial<ByChannel<T>>;

// Placeholders / helpers
export const EMPTY_DRAFT: Draft = {
  draft_md: "",
  title_candidates: [],
  body_html: "",
  body_md: "",
  body_md_lines: [""],
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
