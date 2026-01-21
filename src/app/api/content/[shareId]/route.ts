import { getContentRepo } from "@/server/repositories";
import { fail, ok, newRequestId } from "@/server/errors";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const requestId = newRequestId();
  const { shareId } = await params;
  const repo = getContentRepo();
  const record = await repo.get(shareId);

  if (!record) {
    return fail({ code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다.", status: 404, requestId });
  }

  return ok(record, 200);
}
