import { z } from "zod";

export const DraftLinkedinLLMResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(3).max(6),
  body_md_lines: z.array(z.string().max(4000)).min(10).max(200),
});

export type DraftLinkedinLLMResponse = z.infer<typeof DraftLinkedinLLMResponseSchema>;

export const DraftLinkedinResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(3).max(6),
  body_md: z.string(),
  body_html: z.string(),
});

export type DraftLinkedinResponse = z.infer<typeof DraftLinkedinResponseSchema>;

export const DraftLinkedinOutputSchema = DraftLinkedinResponseSchema;
export type DraftLinkedinOutput = DraftLinkedinResponse;
