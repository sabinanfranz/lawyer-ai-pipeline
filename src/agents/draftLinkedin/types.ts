import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidate } from "@/agents/topicCandidates";
import type { DraftLinkedinOutput } from "./schema";

export type DraftLinkedinInput = {
  intake: IntakeInput;
  topic_candidates?: unknown;
  selected_candidate: TopicCandidate;
  normalized_brief?: unknown;
};

export type DraftLinkedinOutputType = DraftLinkedinOutput;
