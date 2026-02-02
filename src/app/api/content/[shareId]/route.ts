import { getContentRepo } from "@/server/repositories";
import { fail, ok, newRequestId } from "@/server/errors";
import { CHANNELS, type Channel } from "@/shared/channel";
import type { ContentRecord, ContentRecordMulti } from "@/server/repositories/contentRepo";
import type { GetContentResponse } from "@/shared/apiContracts";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const requestId = newRequestId();
  const { shareId } = await params;
  if (!shareId || shareId === "undefined") {
    console.warn("[API_CONTENT_GET] invalid shareId", { shareId });
    return fail({
      code: "INVALID_INPUT",
      message: "Invalid shareId",
      status: 400,
      requestId,
    });
  }
  console.log("[API_CONTENT_GET]", { shareId, requestId });
  const repo = getContentRepo();
  const record = await repo.getByShareIdMulti(shareId);

  if (!record) {
    console.warn("[API_CONTENT_GET] not found", { shareId, requestId });
    return fail({ code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다.", status: 404, requestId });
  }

  const normalized = ensureDrafts(record);

  const out: GetContentResponse = normalized;
  return ok(out, 200);
}

const PLACEHOLDER_DRAFT = {
  draft_md: "(초안이 아직 생성되지 않았습니다.)",
  title_candidates: [] as string[],
  body_md: "(초안이 아직 생성되지 않았습니다.)",
  body_md_lines: ["(초안이 아직 생성되지 않았습니다.)"],
  body_html: "<p>(초안이 아직 생성되지 않았습니다.)</p>",
};

function ensureDrafts(record: ContentRecordMulti | ContentRecord) {
  const base = normalizeLegacy(record);
  const drafts: Record<Channel, typeof PLACEHOLDER_DRAFT | any> = {} as any;
  CHANNELS.forEach((ch) => {
    if (base.drafts && (base.drafts as any)[ch]) {
      drafts[ch] = syncLegacyDraftFields((base.drafts as any)[ch]);
    }
  });
  for (const ch of CHANNELS) {
    if (!drafts[ch]) drafts[ch] = PLACEHOLDER_DRAFT;
  }
  return { ...base, drafts };
}

function syncLegacyDraftFields(draft: any) {
  const draft_md =
    draft?.draft_md ??
    (draft as Record<string, unknown> | undefined)?.["body_md"] ??
    PLACEHOLDER_DRAFT.draft_md;
  return {
    draft_md,
    title_candidates: draft?.title_candidates ?? [],
    body_md: draft_md,
    body_md_lines: draft?.body_md_lines ?? [draft_md],
    body_html: (draft as Record<string, unknown> | undefined)?.["body_html"] ?? PLACEHOLDER_DRAFT.body_html,
    raw_json: draft?.raw_json,
  };
}

function normalizeLegacy(rec: ContentRecordMulti | ContentRecord): ContentRecordMulti {
  if ("drafts" in rec) {
    return {
      ...rec,
      revised: rec.revised,
      compliance_reports: rec.compliance_reports,
    };
  }

  const single = rec as ContentRecord;
  const drafts: Partial<Record<Channel, any>> = single.draft ? { naver: single.draft } : {};
  const revised: Partial<Record<Channel, any>> | undefined = single.revised
    ? { naver: single.revised }
    : undefined;
  const compliance_reports: Partial<Record<Channel, any>> | undefined = single.compliance_report
    ? { naver: single.compliance_report }
    : undefined;

  return {
    shareId: single.shareId,
    status: single.status,
    createdAt: single.createdAt,
    updatedAt: single.updatedAt,
    intake: single.intake,
    topic_candidates: single.topic_candidates,
    selected_candidate: single.selected_candidate,
    drafts,
    revised,
    compliance_reports,
  };
}
