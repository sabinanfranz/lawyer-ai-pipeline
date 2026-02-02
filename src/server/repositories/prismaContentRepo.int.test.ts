import { describe, expect, it, beforeEach } from "vitest";
import { PrismaContentRepo } from "./prismaContentRepo";
import { prisma } from "@/server/db/prisma";
import { CHANNELS } from "@/shared/channel";

const repo = new PrismaContentRepo();

const hasDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === "1";

const sampleMeta = {
  intake: { industry: "test", target_role: "ceo", issue_stage: "pre", pain_picker: [], content_goal: "lead", offer_material: "pdf" } as any,
  topic_candidates: { normalized_brief: "n", candidates: [], top3_recommendations: [] } as any,
  selected_candidate: { id: 1 } as any,
};

const sampleDraft = {
  title_candidates: ["a"],
  body_md: "md",
  body_html: "<p>md</p>",
};

describe("PrismaContentRepo integration", () => {
  if (!hasDb) {
    it.skip("skipped because DATABASE_URL is not set", () => {});
    return;
  }

  beforeEach(async () => {
    await prisma.complianceReport.deleteMany();
    await prisma.contentVersion.deleteMany();
    await prisma.content.deleteMany();
  });

  it("creates drafts for all channels and normalizes GET", async () => {
    await repo.createContentWithDrafts({
      shareId: "s1",
      status: "drafted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...sampleMeta,
      draftsByChannel: { naver: sampleDraft },
    });

    const rec = await repo.getByShareIdMulti("s1");
    expect(rec).toBeTruthy();
    CHANNELS.forEach((ch) => {
      expect(rec!.drafts[ch]).toBeTruthy();
      expect((rec!.drafts[ch] as any).draft_md).toBeTypeOf("string");
    });
  });

  it("updates status to revised only when all channels have revised", async () => {
    await repo.createContentWithDrafts({
      shareId: "s2",
      status: "drafted",
      ...sampleMeta,
      draftsByChannel: { naver: sampleDraft },
    });
    await repo.setRevisedByChannel("s2", "naver", { revised_md: "r", revised_html: "<p>r</p>", report: { risk_score: 1, summary: "", issues: [] } });
    let rec = await repo.getByShareIdMulti("s2");
    expect(rec?.status).toBe("drafted");

    for (const ch of ["linkedin", "threads"] as const) {
      await repo.setRevisedByChannel("s2", ch, { revised_md: "r", revised_html: "<p>r</p>", report: { risk_score: 1, summary: "", issues: [] } });
    }
    rec = await repo.getByShareIdMulti("s2");
    expect(rec?.status).toBe("revised");
  });

  it("setRevisedByChannel is idempotent per channel", async () => {
    await repo.createContentWithDrafts({
      shareId: "s3",
      status: "drafted",
      ...sampleMeta,
      draftsByChannel: { naver: sampleDraft, linkedin: sampleDraft, threads: sampleDraft },
    });
    await repo.setRevisedByChannel("s3", "naver", { revised_md: "r1", revised_html: "<p>r1</p>", report: { risk_score: 1, summary: "a", issues: [] } });
    await repo.setRevisedByChannel("s3", "naver", { revised_md: "r2", revised_html: "<p>r2</p>", report: { risk_score: 99, summary: "b", issues: [] } });
    const versions = await prisma.contentVersion.findMany({ where: { versionType: "revised", channel: "naver", content: { shareId: "s3" } } });
    const reports = await prisma.complianceReport.findMany({ where: { channel: "naver", content: { shareId: "s3" } } });
    expect(versions.length).toBe(1);
    expect(reports.length).toBe(1);
  });
});
