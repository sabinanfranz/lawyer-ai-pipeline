import { z } from "zod";
import { IntakeSchema } from "@/lib/schemas/intake";
import { TopicCandidatesResponseSchema, TopicCandidateSchema } from "@/agents/topicCandidates/schema";
import { getContentRepo } from "@/server/repositories";
import { generateShareId } from "@/lib/utils/shareId";
import { runAgent } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId, readJson, zodDetails } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";

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

  const DRAFT_AGENT_BY_CHANNEL: Record<Channel, any> = {
    naver: "draftNaver",
    linkedin: "draftLinkedin",
    threads: "draftThreads",
  };

  const runDraft = async (channel: Channel) => {
    const agentName = DRAFT_AGENT_BY_CHANNEL[channel];
    const prompt_version = channel === "naver" ? "v3" : "v2";
    const res = await runAgent(agentName, agentInput, {
      variant_key: "default",
      prompt_version,
      scope_key: shareId,
    });
    if (!res.ok) throw new Error(`agent_failed:${agentName}`);
    return res.data as {
      title_candidates: string[];
      body_md: string;
      body_html: string;
    };
  };

  const emergencyFallbackDraft = async (channel: Channel) => {
    if (channel === "naver") {
      const { fallbackDraftNaver } = await import("@/agents/draftNaver");
      const base = fallbackDraftNaver(agentInput);
      return {
        title_candidates: base.title_candidates,
        body_md: base.body_md_lines.join("\n"),
        body_html: base.body_md_lines.join("\n"),
      };
    }
    if (channel === "linkedin") {
      const { fallbackDraftLinkedin } = await import("@/agents/draftLinkedin");
      const base = fallbackDraftLinkedin();
      return {
        title_candidates: base.title_candidates,
        body_md: base.body_md_lines.join("\n"),
        body_html: base.body_md_lines.join("\n"),
      };
    }
    const { fallbackDraftThreads } = await import("@/agents/draftThreads");
    const base = fallbackDraftThreads();
    return {
      title_candidates: base.title_candidates,
      body_md: base.body_md_lines.join("\n"),
      body_html: base.body_md_lines.join("\n"),
    };
  };

  const settled = await Promise.allSettled(
    CHANNELS.map(async (channel) => {
      try {
        const data = await runDraft(channel);
        return { channel, data };
      } catch (e) {
        console.warn("[API_CONTENT] draft failed, using fallback", { channel, shareId, requestId, error: String(e) });
        return { channel, data: await emergencyFallbackDraft(channel) };
      }
    })
  );

  const draftsByChannel: Record<Channel, { title_candidates: string[]; body_md: string; body_html: string }> = {
    naver: await emergencyFallbackDraft("naver"),
    linkedin: await emergencyFallbackDraft("linkedin"),
    threads: await emergencyFallbackDraft("threads"),
  };

  settled.forEach((r) => {
    if (r.status === "fulfilled") {
      draftsByChannel[r.value.channel] = r.value.data;
    }
  });

  const now = new Date().toISOString();

  try {
    await repo.createContentWithDrafts({
      shareId,
      status: "drafted",
      createdAt: now,
      updatedAt: now,
      intake: parsed.data.intake,
      topic_candidates: parsed.data.topic_candidates,
      selected_candidate: parsed.data.selected_candidate,
      draftsByChannel,
    });
  } catch (e) {
    console.error("[API_CONTENT] createContentWithDrafts failed", { shareId, requestId, error: String(e) });
    return fail({
      code: "DB_ERROR",
      message: "초안 저장에 실패했습니다.",
      status: 500,
      requestId,
    });
  }

  return ok({ shareId }, 200);
}
