import crypto from "node:crypto";
import { InMemoryContentRepo } from "@/server/repositories/inMemoryContentRepo";
import type { ContentRecord } from "@/server/repositories/contentRepo";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

test("InMemoryContentRepo.setRevised is idempotent", async () => {
  const repo = new InMemoryContentRepo();

  const record: ContentRecord = {
    shareId: "test123",
    status: "drafted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    intake: { any: "data" } as any,
    topic_candidates: { normalized_brief: {}, candidates: [], top3_recommendations: [] } as any,
    selected_candidate: { id: 1 } as any,

    draft: { title_candidates: ["t"], body_md: "md", body_html: "<p>md</p>" },
  };

  await repo.create(record);

  const once = await repo.setRevised("test123", {
    revised_md: "rev",
    revised_html: "<p>rev</p>",
    report: { risk_score: 10, summary: "s", issues: [] },
  });

  const twice = await repo.setRevised("test123", {
    revised_md: "rev2",
    revised_html: "<p>rev2</p>",
    report: { risk_score: 99, summary: "changed", issues: [{ x: 1 } as any] },
  });

  expect(once).not.toBeNull();
  expect(twice).not.toBeNull();
  expect(twice?.revised?.revised_md).toBe("rev");
  expect(twice?.compliance_report?.risk_score).toBe(10);
});
