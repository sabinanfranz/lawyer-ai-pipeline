import { z } from "zod";

export const DraftThreadsLLMResponseSchema = z.object({
  title_candidates: z.array(z.string().min(1)).min(3).max(6),
  // 단순화: LLM 출력 그대로 통과시키기 위해 줄바꿈 허용, 개수 제약 완화
  body_md_lines: z.array(z.string().max(4000)).min(1).max(200),
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
