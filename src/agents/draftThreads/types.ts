import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidate } from "@/agents/topicCandidates";
import type { DraftThreadsOutput } from "./schema";

export type DraftThreadsInput = {
  intake: IntakeInput;
  topic_candidates?: unknown;
  selected_candidate: TopicCandidate;
  normalized_brief?: unknown;
};

export type DraftThreadsOutputType = DraftThreadsOutput;
