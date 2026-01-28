import { IntakeSchema } from "@/lib/schemas/intake";
import { runAgent } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId, readJson, zodDetails } from "@/server/errors";
import { debugLog } from "@/agent_core/debug";
import type { TopicCandidatesResponse } from "@/shared/apiContracts";
import { TopicCandidatesResponseSchema } from "@/agents/topicCandidates/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const body = await readJson(req);
  const parsed = IntakeSchema.safeParse(body);

  if (!parsed.success) {
    return fail({
      code: "INVALID_INPUT",
      message: "입력값이 올바르지 않습니다.",
      status: 400,
      requestId,
      details: zodDetails(parsed.error),
    });
  }

  debugLog("API_TOPIC_CANDIDATES", "request", {
    prompt_version: "v2",
    variant_key: "default",
    industry: parsed.data.industry,
    target_role: parsed.data.target_role,
    issue_stage: parsed.data.issue_stage,
  });

  const result = await runAgent("topicCandidates", parsed.data, {
    variant_key: "default",
    prompt_version: "v2",
    scope_key: "single",
  });

  if (!result.ok) {
    return fail({
      code: "AGENT_FAILED",
      message: "주제 후보 생성에 실패했습니다.",
      status: 500,
      requestId,
      details: { agent: "topicCandidates" },
    });
  }

  const parsedOut = TopicCandidatesResponseSchema.safeParse(result.data);
  if (!parsedOut.success) {
    console.error("[API_TOPIC_CANDIDATES] agent output invalid", parsedOut.error.flatten());
    return Response.json({ error: "AGENT_FAILED" }, { status: 502 });
  }

  const out: TopicCandidatesResponse = parsedOut.data;
  return ok(out, 200);
}
