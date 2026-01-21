import { getContentRepo } from "@/server/repositories";
import { runAgent } from "@/agent_core/orchestrator";
import { fail, ok, newRequestId } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const requestId = newRequestId();
  const { shareId } = await params;
  const repo = getContentRepo();
  const record = await repo.get(shareId);

  if (!record) return fail({ code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다.", status: 404, requestId });

  // idempotent
  if (record.revised && record.compliance_report) {
    return ok(record, 200);
  }

  const result = await runAgent(
    "complianceRewrite",
    { draft: record.draft, must_avoid: record.intake.must_avoid ?? "" },
    { variant_key: "default", prompt_version: "v1", scope_key: record.shareId }
  );

  if (!result.ok) {
    return fail({
      code: "AGENT_FAILED",
      message: "컴플라이언스 수정 생성에 실패했습니다.",
      status: 500,
      requestId,
      details: { agent: "complianceRewrite" },
    });
  }

  const out = result.data as any;

  const updated = await repo.setRevised(record.shareId, {
    revised_md: out.revised_md,
    revised_html: out.revised_html,
    report: out.report,
  });

  if (!updated) {
    return fail({
      code: "DB_ERROR",
      message: "수정본 저장에 실패했습니다.",
      status: 500,
      requestId,
    });
  }

  return ok(updated, 200);
}
