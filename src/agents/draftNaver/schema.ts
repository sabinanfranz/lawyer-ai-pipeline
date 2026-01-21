import { z } from "zod";

export const DraftNaverOutputSchema = z.object({
  title_candidates: z.array(z.string()).min(1),
  body_md: z.string(),
  body_html: z.string(),
});

export type DraftNaverOutput = z.infer<typeof DraftNaverOutputSchema>;
