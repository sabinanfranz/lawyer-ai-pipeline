import { z } from "zod";
import { IntakeSchema } from "@/lib/schemas/intake";
import { TopicCandidatesResponseSchema, TopicCandidateSchema } from "@/agents/topicCandidates/schema";
import { getContentRepo } from "@/server/repositories";
import { generateShareId } from "@/lib/utils/shareId";
import { runAgent } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId, readJson, zodDetails } from "@/server/errors";

export const runtime = "nodejs";

const CreateContentSchema = z.object({
  intake: IntakeSchema,
  topic_candidates: TopicCandidatesResponseSchema,
  selected_candidate: TopicCandidateSchema,
});

export async function POST(req: Request) {
  const requestId = newRequestId();
  const body = await readJson(req);
  const parsed = CreateContentSchema.safeParse(body);

  if (!parsed.success) {
    return fail({
      code: "INVALID_INPUT",
      message: "입력값이 올바르지 않습니다.",
      status: 400,
      requestId,
      details: zodDetails(parsed.error),
    });
  }

  const shareId = generateShareId();
  const repo = getContentRepo();

  const agentInput = {
    intake: parsed.data.intake,
    selected_candidate: parsed.data.selected_candidate,
    normalized_brief: parsed.data.topic_candidates.normalized_brief,
  };

  const result = await runAgent("draftNaver", agentInput, {
    variant_key: "default",
    prompt_version: "v1",
    scope_key: shareId,
  });

  if (!result.ok) {
    return fail({
      code: "AGENT_FAILED",
      message: "초안 생성에 실패했습니다.",
      status: 500,
      requestId,
      details: { agent: "draftNaver" },
    });
  }

  const now = new Date().toISOString();

  await repo.create({
    shareId,
    status: "drafted",
    createdAt: now,
    updatedAt: now,
    intake: parsed.data.intake,
    topic_candidates: parsed.data.topic_candidates,
    selected_candidate: parsed.data.selected_candidate,
    draft: result.data as any,
  });

  return ok({ shareId }, 200);
}
