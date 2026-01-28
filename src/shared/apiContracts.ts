// Shared API request/response contracts (type-only SSOT)
import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse as TopicCandidatesResponsePayload } from "@/agents/topicCandidates/schema";
import type { CreateContentInput } from "@/lib/schemas/createContent";
import type { ContentRecordMulti } from "@/server/repositories/contentRepo";

export type ShareId = string;

// POST /api/topic-candidates
export type TopicCandidatesRequest = IntakeInput;
export type TopicCandidatesResponse = TopicCandidatesResponsePayload;

// POST /api/content
export type CreateContentRequest = CreateContentInput;
export type CreateContentResponse = { shareId: ShareId };

// GET /api/content/[shareId]
export type GetContentResponse = ContentRecordMulti;

// POST /api/content/[shareId]/approve
export type ApproveContentResponse = ContentRecordMulti;
