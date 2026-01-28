import { z } from "zod";
import { IntakeSchema } from "./intake";
import { TopicCandidatesResponseSchema, TopicCandidateSchema } from "@/agents/topicCandidates/schema";

export const CreateContentSchema = z.object({
  intake: IntakeSchema,
  topic_candidates: TopicCandidatesResponseSchema,
  selected_candidate: TopicCandidateSchema,
});

export type CreateContentInput = z.infer<typeof CreateContentSchema>;
