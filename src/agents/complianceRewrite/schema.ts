import { z } from "zod";
import { CHANNELS } from "@/shared/channel";

export const ComplianceIssueSchema = z.object({
  category: z.string(),
  snippet: z.string(),
  reason: z.string(),
  suggestion: z.string(),
});

export type ComplianceIssue = z.infer<typeof ComplianceIssueSchema>;

export const ComplianceReportSchema = z.object({
  risk_score: z.number().int().min(0).max(100),
  summary: z.string(),
  issues: z.array(ComplianceIssueSchema),
});

export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

export const ComplianceRewriteOutputSchema = z.object({
  revised_md: z.string(),
  revised_html: z.string(),
  report: ComplianceReportSchema,
});

export type ComplianceRewriteOutput = z.infer<typeof ComplianceRewriteOutputSchema>;

// LLM 출력은 report 없이(정량/룰 오염 방지)
export const ComplianceRewriteLlmSchema = z.object({
  revised_md: z.string(),
  revised_html: z.string(),
});
export type ComplianceRewriteLlmOutput = z.infer<typeof ComplianceRewriteLlmSchema>;

// ---- Input V1 (PR4): approve → complianceRewrite 계약 고정 ----
export const ChannelSchema = z.enum(CHANNELS);

export const ComplianceRewriteInputV1Schema = z
  .object({
    body_md: z.string().min(1),
    must_avoid: z.string().optional().default(""),
    channel: ChannelSchema,
  })
  .passthrough();

export type ComplianceRewriteInputV1 = z.infer<typeof ComplianceRewriteInputV1Schema>;
