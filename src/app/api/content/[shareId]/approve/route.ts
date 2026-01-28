import { getContentRepo } from "@/server/repositories";
import { runAgent } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";
import type { ContentRecordMulti } from "@/server/repositories/contentRepo";

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

  const settled = await Promise.allSettled(
    channelsToRewrite.map(async (channel) => {
      const draftRaw = record.drafts[channel];
      const draft = {
        ...draftRaw,
        title_candidates: (draftRaw.title_candidates ?? []).slice(0, 5),
      };
      const result = await runAgent(
        "complianceRewrite",
        { draft, must_avoid: (record.intake as any)?.must_avoid ?? "" },
        { variant_key: channel, prompt_version: "v2", scope_key: record.shareId }
      );
      if (!result.ok) throw new Error("AGENT_FAILED:" + channel);
      return { channel, data: result.data as any };
    })
  );

  const hasRejected = settled.some((s) => s.status === "rejected");

  for (const s of settled) {
    if (s.status !== "fulfilled") {
      console.error("[API_APPROVE] compliance rewrite failed", { shareId, requestId, error: s.reason });
      continue;
    }
    const { channel, data } = s.value;
    try {
      await repo.setRevisedByChannel(record.shareId, channel as Channel, {
        revised_md: data.revised_md,
        revised_html: data.revised_html,
        report: data.report,
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

  return ok(updated, 200);
}
