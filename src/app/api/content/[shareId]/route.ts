import { getContentRepo } from "@/server/repositories";
import { fail, ok, newRequestId } from "@/server/errors";

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
  const record = await repo.get(shareId);

  if (!record) {
    console.warn("[API_CONTENT_GET] not found", { shareId, requestId });
    return fail({ code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다.", status: 404, requestId });
  }

  return ok(record, 200);
}
