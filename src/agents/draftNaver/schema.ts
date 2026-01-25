import { z } from "zod";

// LLM output schema (line-based Markdown)
export const DraftNaverLLMResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(1),
  body_md_lines: z.array(z.string()),
});

export type DraftNaverLLMResponse = z.infer<typeof DraftNaverLLMResponseSchema>;

// Final output schema (what API/UI/DB expects)
export const DraftNaverResponseSchema = z.object({
  title_candidates: z.array(z.string()),
  body_md: z.string(),
  body_html: z.string(),
});

export type DraftNaverResponse = z.infer<typeof DraftNaverResponseSchema>;

// Backward-compatible alias
export const DraftNaverOutputSchema = DraftNaverResponseSchema;
export type DraftNaverOutput = DraftNaverResponse;
