import { z } from "zod";

export const DraftThreadsLLMResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(3).max(6),
  body_md_lines: z
    .array(
      z
        .string()
        .max(4000)
        .refine((v) => !v.includes("\n"), { message: "body_md_lines must be single-line" })
    )
    .min(3)
    .max(3),
});

export type DraftThreadsLLMResponse = z.infer<typeof DraftThreadsLLMResponseSchema>;

export const DraftThreadsResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(3).max(6),
  body_md: z.string(),
  body_html: z.string(),
});

export type DraftThreadsResponse = z.infer<typeof DraftThreadsResponseSchema>;

export const DraftThreadsOutputSchema = DraftThreadsResponseSchema;
export type DraftThreadsOutput = DraftThreadsResponse;
