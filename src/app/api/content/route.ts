import { z } from "zod";
import { IntakeSchema } from "@/lib/schemas/intake";
import { TopicCandidatesResponseSchema, TopicCandidateSchema } from "@/agents/topicCandidates/schema";
import { getContentRepo } from "@/server/repositories";
import { generateShareId } from "@/lib/utils/shareId";
import { runAgentWithDebug } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId, readJson, zodDetails } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";
import { toMetaAgentDebug } from "@/shared/agentDebugMeta";
import type { PartialByChannel } from "@/shared/contentTypes.vnext";

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
    const prompt_version = "v3";
    const { result: res, debug } = await runAgentWithDebug(agentName, agentInput, {
      variant_key: "default",
      prompt_version,
      scope_key: shareId,
    });
    if (!res.ok) throw new Error(`agent_failed:${agentName}`);
    return {
      data: res.data as {
        title_candidates: string[];
        body_md: string;
        body_html: string;
      },
      debug,
    };
  };

  const makeDebugFallback = (channel: Channel) =>
    toMetaAgentDebug({
      run_id: `fallback:${channel}`,
      agent_name: DRAFT_AGENT_BY_CHANNEL[channel],
      agent_version: "unknown",
      variant_key: "default",
      prompt_version: "v3",
      scope_key: shareId,
      llm_mode: "unknown",
      cache_hit: false,
      used_fallback: true,
      repaired: false,
      repair_attempts: 0,
      latency_ms: 0,
      error_kind: "FALLBACK_EMERGENCY",
    });

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
        const { data, debug } = await runDraft(channel);
        return { channel, data, debug };
      } catch (e) {
        console.warn("[API_CONTENT] draft failed, using fallback", { channel, shareId, requestId, error: String(e) });
        return { channel, data: await emergencyFallbackDraft(channel), debug: makeDebugFallback(channel) };
      }
    })
  );

  const draftsByChannel: Record<Channel, { title_candidates: string[]; body_md: string; body_html: string }> = {
    naver: await emergencyFallbackDraft("naver"),
    linkedin: await emergencyFallbackDraft("linkedin"),
    threads: await emergencyFallbackDraft("threads"),
  };
  const metaBase = {
    intake: parsed.data.intake,
    topic_candidates: parsed.data.topic_candidates,
    selected_candidate: parsed.data.selected_candidate,
  };
  const metaByChannel: PartialByChannel<any> = {
    naver: { ...metaBase, agent_debug: makeDebugFallback("naver") },
    linkedin: { ...metaBase, agent_debug: makeDebugFallback("linkedin") },
    threads: { ...metaBase, agent_debug: makeDebugFallback("threads") },
  };

  settled.forEach((r) => {
    if (r.status === "fulfilled") {
      draftsByChannel[r.value.channel] = r.value.data;
      metaByChannel[r.value.channel] = {
        ...metaBase,
        agent_debug: toMetaAgentDebug(r.value.debug),
      };
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
      metaByChannel,
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
