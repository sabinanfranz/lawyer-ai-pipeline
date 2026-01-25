import { z } from "zod";

export const TopicCandidateSchema = z.object({
  id: z.number().int(),
  title_search: z.string(),
  title_share: z.string(),
  smartblock_intent: z.enum(["reaction_response", "info_exploration", "case_analysis", "checklist_template"]),
  content_role: z.enum(["cluster", "pillar"]),
  hook: z.string(),
  risk_solved: z.string(),
  format: z.enum(["checklist", "guide", "faq", "copy_examples"]),
  primary_keyword: z.string(),
  longtail_keywords: z.tuple([z.string(), z.string(), z.string()]),
  deliverable: z.string(),
  cta_one: z.string(),
  difficulty: z.enum(["하", "중", "상"]),
  risk_level: z.enum(["하", "중", "상"]),
  hitl_points: z.tuple([z.string(), z.string()]),
});

export const TopicCandidatesResponseSchema = z.object({
  normalized_brief: z.object({
    persona_summary: z.string(),
    pain_summary: z.string(),
    assumptions: z.array(z.string()).min(2).max(4),
  }),
  candidates: z.array(TopicCandidateSchema).length(7),
  top3_recommendations: z.array(z.object({ id: z.number().int(), why: z.string() })).length(3),
});

export type TopicCandidatesResponse = z.infer<typeof TopicCandidatesResponseSchema>;
export type TopicCandidate = z.infer<typeof TopicCandidateSchema>;
export type NormalizedBrief = z.infer<typeof TopicCandidatesResponseSchema>["normalized_brief"];
