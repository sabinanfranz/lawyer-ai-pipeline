import { getContentRepo } from "@/server/repositories";
import { generateShareId } from "@/lib/utils/shareId";
import { runAgentWithDebug } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId, readJson, zodDetails } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";
import { toMetaAgentDebug } from "@/shared/agentDebugMeta";
import type { PartialByChannel, Draft } from "@/shared/contentTypes.vnext";
import { CreateContentSchema } from "@/lib/schemas/createContent";
import type { CreateContentResponse } from "@/shared/apiContracts";
import { mdToHtml } from "@/lib/utils/mdToHtml";

export const runtime = "nodejs";

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
      data: res.data as Draft,
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

  const emergencyFallbackDraft = async (channel: Channel): Promise<Draft> => {
    if (channel === "naver") {
      const { fallbackDraftNaver } = await import("@/agents/draftNaver");
      return fallbackDraftNaver(agentInput);
    }
    if (channel === "linkedin") {
      const { fallbackDraftLinkedin } = await import("@/agents/draftLinkedin");
      return fallbackDraftLinkedin();
    }
    const { fallbackDraftThreads } = await import("@/agents/draftThreads");
    return fallbackDraftThreads();
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

  const draftsByChannel: Record<Channel, Draft> = {
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

  // normalize drafts for storage (fill legacy fields for compatibility)
  CHANNELS.forEach((ch) => {
    const d = draftsByChannel[ch];
    const dAny = d as Record<string, unknown>;
    const md = d.draft_md ?? (dAny["body_md"] as string | undefined) ?? "";
    draftsByChannel[ch] = {
      draft_md: md,
      title_candidates: d.title_candidates ?? [],
      body_md: md,
      body_md_lines: (dAny["body_md_lines"] as string[] | undefined) ?? [md],
      body_html: (dAny["body_html"] as string | undefined) ?? mdToHtml(md),
      // raw_json is only available on DraftRawV1; ignore if missing
    };
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

  const out: CreateContentResponse = { shareId };
  return ok(out, 200);
}
