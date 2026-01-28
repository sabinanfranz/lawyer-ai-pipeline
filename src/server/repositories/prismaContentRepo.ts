import { prisma } from "@/server/db/prisma";
import type { Channel } from "@/shared/channel";
import { CHANNELS } from "@/shared/channel";
import {
  PRIMARY_CHANNEL,
  type ComplianceReportPayload,
  type ContentRecord,
  type ContentRecordMulti,
  type ContentRepo,
  type DraftPayload,
  type RevisedPayload,
  type CreateDraftsArgs,
} from "./contentRepo";
import type { ContentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

function ensureStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

function ensureIssuesArray(v: unknown): any[] {
  if (!Array.isArray(v)) return [];
  return v;
}

function isUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export class PrismaContentRepo implements ContentRepo {
  // ---- Legacy single-channel wrappers ----
  async create(record: ContentRecord): Promise<void> {
    await this.createContentWithDrafts({
      shareId: record.shareId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      intake: record.intake,
      topic_candidates: record.topic_candidates,
      selected_candidate: record.selected_candidate,
      draftsByChannel: { [PRIMARY_CHANNEL]: record.draft },
    });
  }

  async get(shareId: string): Promise<ContentRecord | null> {
    const multi = await this.getByShareIdMulti(shareId);
    if (!multi) return null;

    const draft = pickPrimary(multi.drafts) ?? firstAvailable(multi.drafts);
    if (!draft) return null;

    return {
      shareId: multi.shareId,
      status: multi.status,
      createdAt: multi.createdAt,
      updatedAt: multi.updatedAt,
      intake: multi.intake,
      topic_candidates: multi.topic_candidates,
      selected_candidate: multi.selected_candidate,
      draft,
      revised: pickPrimary(multi.revised),
      compliance_report: pickPrimary(multi.compliance_reports),
    };
  }

  async setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null> {
    const multi = await this.setRevisedByChannel(shareId, PRIMARY_CHANNEL, patch);
    if (!multi) return null;
    return this.get(shareId);
  }

  // ---- Multi-channel APIs ----

  async createContentWithDrafts(args: CreateDraftsArgs): Promise<void> {
    const metaSnapshot = {
      intake: args.intake,
      topic_candidates: args.topic_candidates,
      selected_candidate: args.selected_candidate,
    };

    const content = await prisma.content.create({
      data: {
        shareId: args.shareId,
        status: args.status as ContentStatus,
        ...(args.createdAt ? { createdAt: new Date(args.createdAt) } : {}),
        ...(args.updatedAt ? { updatedAt: new Date(args.updatedAt) } : {}),
      },
    });

    const draftCreates = Object.entries(args.draftsByChannel)
      .filter(([, draft]) => !!draft)
      .map(([channel, draft]) => ({
        contentId: content.id,
        channel: channel as Channel,
        versionType: "draft" as const,
        titleCandidates: (draft as DraftPayload).title_candidates,
        bodyMd: (draft as DraftPayload).body_md,
        bodyHtml: (draft as DraftPayload).body_html,
        meta: metaSnapshot,
      }));

    if (draftCreates.length) {
      await prisma.contentVersion.createMany({ data: draftCreates });
    }
  }

  async getByShareIdMulti(shareId: string): Promise<ContentRecordMulti | null> {
    const content = await prisma.content.findUnique({
      where: { shareId },
      include: { versions: true, complianceReports: true },
    });
    if (!content) return null;

    const meta = pickMeta(content.versions);
    if (!meta || !meta.intake || !meta.topic_candidates || !meta.selected_candidate) return null;

    const drafts: Partial<Record<Channel, DraftPayload>> = {};
    const revised: Partial<Record<Channel, RevisedPayload>> = {};

    content.versions.forEach((v) => {
      if (v.versionType === "draft") {
        drafts[v.channel as Channel] = {
          title_candidates: ensureStringArray(v.titleCandidates),
          body_md: v.bodyMd,
          body_html: v.bodyHtml,
        };
      } else if (v.versionType === "revised") {
        revised[v.channel as Channel] = {
          revised_md: v.bodyMd,
          revised_html: v.bodyHtml,
        };
      }
    });

    const compliance_reports: Partial<Record<Channel, ComplianceReportPayload>> = {};
    content.complianceReports.forEach((r) => {
      compliance_reports[r.channel as Channel] = {
        risk_score: r.riskScore ?? 0,
        summary: r.summary ?? "",
        issues: ensureIssuesArray(r.issues) as any,
      };
    });

    return {
      shareId: content.shareId,
      status: content.status as any,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
      intake: meta.intake,
      topic_candidates: meta.topic_candidates,
      selected_candidate: meta.selected_candidate,
      drafts,
      revised: Object.keys(revised).length ? revised : undefined,
      compliance_reports: Object.keys(compliance_reports).length ? compliance_reports : undefined,
    };
  }

  async setRevisedByChannel(
    shareId: string,
    channel: Channel,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecordMulti | null> {
    const content = await prisma.content.findUnique({
      where: { shareId },
      select: { id: true, status: true },
    });
    if (!content) return null;

    await prisma.$transaction(async (tx) => {
      try {
        await tx.contentVersion.create({
          data: {
            contentId: content.id,
            channel,
            versionType: "revised",
            titleCandidates: null,
            bodyMd: patch.revised_md,
            bodyHtml: patch.revised_html,
            meta: null,
          },
        });
      } catch (e) {
        if (!isUniqueError(e)) throw e;
      }

      const report = patch.report ?? { risk_score: 0, summary: "", issues: [] };
      try {
        await tx.complianceReport.create({
          data: {
            contentId: content.id,
            channel,
            riskScore: report.risk_score ?? 0,
            summary: report.summary ?? "",
            issues: report.issues ?? [],
          },
        });
      } catch (e) {
        if (!isUniqueError(e)) throw e;
      }

      if (content.status !== "revised") {
        // status 업데이트는 채널 전체 완료 시점에 결정
      }
    });

    // 모든 채널 revised 여부 확인 후 status 업데이트
    const versions = await prisma.contentVersion.findMany({
      where: { contentId: content.id, versionType: "revised" },
      select: { channel: true },
    });
    const revisedChannels = new Set(versions.map((v) => v.channel as Channel));
    const allRevised = CHANNELS.every((ch) => revisedChannels.has(ch));
    await prisma.content.update({
      where: { id: content.id },
      data: { status: allRevised ? ("revised" as ContentStatus) : ("drafted" as ContentStatus) },
    });

    return this.getByShareIdMulti(shareId);
  }
}

function pickMeta(
  versions: {
    versionType: string;
    channel: Channel;
    meta: any;
  }[]
): any | null {
  const candidates = [
    versions.find((v) => v.versionType === "draft" && v.channel === PRIMARY_CHANNEL)?.meta,
    versions.find((v) => v.versionType === "draft")?.meta,
    versions.find((v) => v.versionType === "revised")?.meta,
  ];
  return candidates.find((m) => !!m) ?? null;
}

function pickPrimary<T>(byChannel?: Partial<Record<Channel, T>>): T | undefined {
  if (!byChannel) return undefined;
  return byChannel[PRIMARY_CHANNEL];
}

function firstAvailable<T>(byChannel?: Partial<Record<Channel, T>>): T | undefined {
  if (!byChannel) return undefined;
  const key = CHANNELS.find((ch) => byChannel[ch] !== undefined);
  return key ? byChannel[key] : undefined;
}
