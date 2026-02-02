import { getContentRepo } from "@/server/repositories";
import { runAgentWithDebug } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";
import type { ContentRecordMulti } from "@/server/repositories/contentRepo";
import { toMetaAgentDebug } from "@/shared/agentDebugMeta";
import { ComplianceRewriteOutputSchema } from "@/agents/complianceRewrite/schema";
import { normalizeComplianceReportPayload } from "@/server/repositories/prismaContentRepo";
import type { ApproveContentResponse } from "@/shared/apiContracts";
import type { ComplianceRewriteInputV1 } from "@/agents/complianceRewrite/schema";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const requestId = newRequestId();
  const { shareId } = await params;
  if (!shareId || shareId === "undefined") {
    console.warn("[API_APPROVE] invalid shareId", { shareId, requestId });
    return fail({
      code: "INVALID_INPUT",
      message: "Invalid shareId",
      status: 400,
      requestId,
    });
  }
  const repo = getContentRepo();
  const record = await repo.getByShareIdMulti(shareId);

  if (!record) {
    console.warn("[API_APPROVE] not found", { shareId, requestId });
    return fail({ code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다.", status: 404, requestId });
  }

  // drafts 존재 방어
  const missingDrafts = CHANNELS.filter((ch) => !record.drafts?.[ch]);
  if (missingDrafts.length) {
    return fail({
      code: "INTERNAL",
      message: "draft가 누락된 채널이 있습니다.",
      status: 500,
      requestId,
      details: { shareId, missingDrafts },
    });
  }

  // 채널 단위 idempotent
  const channelsToRewrite = CHANNELS.filter((ch) => {
    const hasRevised = !!record.revised?.[ch];
    const hasReport = !!record.compliance_reports?.[ch];
    return !(hasRevised && hasReport);
  });

  if (channelsToRewrite.length === 0) {
    console.log("[API_APPROVE] idempotent-return", { shareId, requestId });
    return ok(record, 200);
  }

  const metaBase = {
    intake: record.intake,
    topic_candidates: record.topic_candidates,
    selected_candidate: record.selected_candidate,
  };

  const settled = await Promise.allSettled(
    channelsToRewrite.map(async (channel) => {
      const draft = record.drafts[channel];
      const body_md = (
        (draft as { draft_md?: string; body_md?: string } | undefined)?.draft_md ??
        (draft as { draft_md?: string; body_md?: string } | undefined)?.body_md ??
        ""
      ).trim();
      // body_md가 비어도 에이전트가 fallback/quality gate로 처리하도록 허용
      const must_avoid = (record.intake as any)?.must_avoid ?? "";

      const input: ComplianceRewriteInputV1 = {
        body_md,
        must_avoid,
        channel,
      };

      const { result, debug } = await runAgentWithDebug(
        "complianceRewrite",
        input,
        { variant_key: channel, prompt_version: "v2", scope_key: record.shareId }
      );
      if (!result.ok) throw new Error("AGENT_FAILED:" + channel);
      const parsed = ComplianceRewriteOutputSchema.safeParse(result.data);
      if (!parsed.success) {
        console.error("[API_APPROVE] agent output invalid", parsed.error.flatten());
        throw new Error("AGENT_FAILED:" + channel);
      }
      return { channel, data: parsed.data, debug };
    })
  );

  const hasRejected = settled.some((s) => s.status === "rejected");

  for (const s of settled) {
    if (s.status !== "fulfilled") {
      console.error("[API_APPROVE] compliance rewrite failed", { shareId, requestId, error: s.reason });
      continue;
    }
    const { channel, data, debug } = s.value;
    const normalizedReport = normalizeComplianceReportPayload(data.report);
    try {
      await repo.setRevisedByChannel(record.shareId, channel as Channel, {
        revised_md: data.revised_md,
        revised_html: data.revised_html,
        report: normalizedReport,
        meta: { ...metaBase, agent_debug: toMetaAgentDebug(debug) },
      });
    } catch (e) {
      console.error("[API_APPROVE] setRevisedByChannel failed", { shareId, channel, requestId, error: String(e) });
      return fail({
        code: "DB_ERROR",
        message: "수정본 저장에 실패했습니다.",
        status: 500,
        requestId,
      });
    }
  }

  if (hasRejected) {
    return fail({
      code: "AGENT_FAILED",
      message: "일부 채널 컴플라이언스 리라이트에 실패했습니다.",
      status: 500,
      requestId,
    });
  }

  const updated = await repo.getByShareIdMulti(shareId);
  if (!updated) {
    return fail({
      code: "DB_ERROR",
      message: "수정본 조회에 실패했습니다.",
      status: 500,
      requestId,
    });
  }

  const out: ApproveContentResponse = updated;
  return ok(out, 200);
}
