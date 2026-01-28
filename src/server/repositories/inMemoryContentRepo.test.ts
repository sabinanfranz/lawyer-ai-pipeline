import crypto from "node:crypto";
import { InMemoryContentRepo } from "@/server/repositories/inMemoryContentRepo";
import type { ContentRecord } from "@/server/repositories/contentRepo";
import { CHANNELS } from "@/shared/channel";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

test("InMemoryContentRepo.setRevised is idempotent (legacy wrapper)", async () => {
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

test("InMemoryContentRepo.setRevisedByChannel is idempotent per channel", async () => {
  const repo = new InMemoryContentRepo();

  await repo.createContentWithDrafts({
    shareId: "multi123",
    status: "drafted",
    intake: { any: "data" } as any,
    topic_candidates: { normalized_brief: {}, candidates: [], top3_recommendations: [] } as any,
    selected_candidate: { id: 1 } as any,
    draftsByChannel: {
      naver: { title_candidates: ["n"], body_md: "n md", body_html: "<p>n</p>" },
      linkedin: { title_candidates: ["l"], body_md: "l md", body_html: "<p>l</p>" },
    },
  });

  await repo.setRevisedByChannel("multi123", "naver", {
    revised_md: "rev-n",
    revised_html: "<p>rev-n</p>",
    report: { risk_score: 1, summary: "n", issues: [] },
  });

  await repo.setRevisedByChannel("multi123", "naver", {
    revised_md: "rev-n2",
    revised_html: "<p>rev-n2</p>",
    report: { risk_score: 999, summary: "override", issues: [{ foo: "bar" } as any] },
  });

  await repo.setRevisedByChannel("multi123", "linkedin", {
    revised_md: "rev-l",
    revised_html: "<p>rev-l</p>",
    report: { risk_score: 2, summary: "l", issues: [] },
  });

  const multi = await repo.getByShareIdMulti("multi123");
  expect(multi).not.toBeNull();
  const naverRev = multi?.revised?.naver;
  const linkedinRev = multi?.revised?.linkedin;
  expect(naverRev?.revised_md).toBe("rev-n");
  expect(multi?.compliance_reports?.naver?.risk_score).toBe(1);
  expect(linkedinRev?.revised_md).toBe("rev-l");
  expect(multi?.compliance_reports?.linkedin?.risk_score).toBe(2);
  const channelsWithRevised = Object.keys(multi?.revised ?? {});
  CHANNELS.forEach((ch) => {
    if (ch === "threads") return;
    expect(channelsWithRevised).toContain(ch);
  });
});
