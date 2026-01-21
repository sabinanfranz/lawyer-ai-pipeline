import { prisma } from "@/server/db/prisma";
import type { ContentRecord, ContentRepo } from "./contentRepo";
import type { ContentStatus, VersionType } from "@prisma/client";

function ensureStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

function ensureIssuesArray(v: unknown): any[] {
  if (!Array.isArray(v)) return [];
  return v;
}

export class PrismaContentRepo implements ContentRepo {
  async create(record: ContentRecord): Promise<void> {
    await prisma.content.create({
      data: {
        shareId: record.shareId,
        status: record.status as ContentStatus,
        versions: {
          create: {
            versionType: "draft" as VersionType,
            titleCandidates: record.draft.title_candidates,
            bodyMd: record.draft.body_md,
            bodyHtml: record.draft.body_html,
            meta: {
              intake: record.intake,
              topic_candidates: record.topic_candidates,
              selected_candidate: record.selected_candidate,
            },
          },
        },
      },
    });
  }

  async get(shareId: string): Promise<ContentRecord | null> {
    const content = await prisma.content.findUnique({
      where: { shareId },
      include: {
        versions: { orderBy: { createdAt: "asc" } },
        complianceReport: true,
      },
    });

    if (!content) return null;

    const draftV = content.versions.find((v) => v.versionType === "draft");
    if (!draftV) return null;

    const meta = (draftV.meta ?? {}) as any;
    const intake = meta.intake;
    const topic_candidates = meta.topic_candidates;
    const selected_candidate = meta.selected_candidate;

    if (!intake || !topic_candidates || !selected_candidate) return null;

    const revisedV = content.versions.find((v) => v.versionType === "revised");

    const record: ContentRecord = {
      shareId: content.shareId,
      status: content.status as any,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),

      intake,
      topic_candidates,
      selected_candidate,

      draft: {
        title_candidates: ensureStringArray(draftV.titleCandidates),
        body_md: draftV.bodyMd,
        body_html: draftV.bodyHtml,
      },

      revised: revisedV
        ? { revised_md: revisedV.bodyMd, revised_html: revisedV.bodyHtml }
        : undefined,

      compliance_report: content.complianceReport
        ? {
            risk_score: content.complianceReport.riskScore,
            summary: content.complianceReport.summary,
            issues: ensureIssuesArray(content.complianceReport.issues) as any,
          }
        : undefined,
    };

    return record;
  }

  async setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null> {
    const content = await prisma.content.findUnique({
      where: { shareId },
      include: { versions: true, complianceReport: true },
    });

    if (!content) return null;

    // Repo 레벨에서도 idempotent(안전)
    const hasRevised = content.versions.some((v) => v.versionType === "revised");
    const hasReport = !!content.complianceReport;
    if (hasRevised && hasReport) {
      return await this.get(shareId);
    }

    await prisma.$transaction(async (tx) => {
      const revisedExists = await tx.contentVersion.findFirst({
        where: { contentId: content.id, versionType: "revised" },
      });

      if (!revisedExists) {
        await tx.contentVersion.create({
          data: {
            contentId: content.id,
            versionType: "revised",
            titleCandidates: null,
            bodyMd: patch.revised_md,
            bodyHtml: patch.revised_html,
            meta: null,
          },
        });
      }

      const report = patch.report ?? { risk_score: 0, summary: "", issues: [] };

      await tx.complianceReport.upsert({
        where: { contentId: content.id },
        create: {
          contentId: content.id,
          riskScore: report.risk_score ?? 0,
          summary: report.summary ?? "",
          issues: report.issues ?? [],
        },
        update: {
          riskScore: report.risk_score ?? 0,
          summary: report.summary ?? "",
          issues: report.issues ?? [],
        },
      });

      await tx.content.update({
        where: { id: content.id },
        data: { status: "revised" },
      });
    });

    return await this.get(shareId);
  }
}
