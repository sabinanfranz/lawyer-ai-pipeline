// Type-only SSOT for ContentVersion.meta payload
import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse } from "@/agents/topicCandidates/schema";
import type { CreateContentInput } from "@/lib/schemas/createContent";

export type SelectedCandidate = CreateContentInput["selected_candidate"];

export type ContentMetaPayload = {
  intake: IntakeInput | null;
  topic_candidates: TopicCandidatesResponse | null;
  selected_candidate: SelectedCandidate | null;
  agent_debug?: unknown;
};
