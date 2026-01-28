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
import { EMPTY_DRAFT, getDraftOrPlaceholder } from "@/shared/contentTypes.vnext";

function ensureStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

export function normalizeComplianceIssues(raw: unknown): ComplianceReportPayload["issues"] {
  if (!Array.isArray(raw)) return [];

  const issues: ComplianceReportPayload["issues"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    const category = String(obj.category ?? "unknown");

    const snippet =
      typeof obj.snippet === "string"
        ? obj.snippet
        : typeof obj.token === "string"
          ? obj.token
          : typeof obj.text === "string"
            ? obj.text
            : "";

    const reason =
      typeof obj.reason === "string"
        ? obj.reason
        : typeof obj.message === "string"
          ? obj.message
          : "";

    const suggestion =
      typeof obj.suggestion === "string"
        ? obj.suggestion
        : typeof obj.fix === "string"
          ? obj.fix
          : "";

    issues.push({
      category,
      snippet,
      reason,
      suggestion,
    });
  }

  return issues;
}

export function normalizeComplianceReport(raw: {
  riskScore?: unknown;
  summary?: unknown;
  issues?: unknown;
}): ComplianceReportPayload {
  const risk_score = typeof raw.riskScore === "number" ? raw.riskScore : 0;
  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const issues = normalizeComplianceIssues(raw.issues);
  return { risk_score, summary, issues };
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

    const complianceReport = pickPrimary(multi.compliance_reports);

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
      compliance_report: complianceReport,
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

    await prisma.$transaction(async (tx) => {
      const content = await tx.content.create({
        data: {
          shareId: args.shareId,
          status: args.status as ContentStatus,
          ...(args.createdAt ? { createdAt: new Date(args.createdAt) } : {}),
          ...(args.updatedAt ? { updatedAt: new Date(args.updatedAt) } : {}),
        },
      });

      const draftCreates = CHANNELS.map((channel) => {
        const draft = getDraftOrPlaceholder(args.draftsByChannel, channel);
        const meta = args.metaByChannel?.[channel] ?? metaSnapshot;
        return {
          contentId: content.id,
          channel,
          versionType: "draft" as const,
          titleCandidates: draft.title_candidates ?? EMPTY_DRAFT.title_candidates,
          bodyMd: draft.body_md ?? EMPTY_DRAFT.body_md,
          bodyHtml: draft.body_html ?? EMPTY_DRAFT.body_html,
          meta,
        };
      });

      await tx.contentVersion.createMany({ data: draftCreates });
    });
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
      compliance_reports[r.channel as Channel] = normalizeComplianceReport(r);
    });

    const fullDrafts: Record<Channel, DraftPayload> = {} as any;
    CHANNELS.forEach((ch) => {
      fullDrafts[ch] = drafts[ch] ?? EMPTY_DRAFT;
    });

    return {
      shareId: content.shareId,
      status: content.status as any,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
      intake: meta.intake,
      topic_candidates: meta.topic_candidates,
      selected_candidate: meta.selected_candidate,
      drafts: fullDrafts,
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
      const existingRevision = await tx.contentVersion.findUnique({
        where: {
          contentId_channel_versionType: { contentId: content.id, channel, versionType: "revised" },
        },
      });
      if (!existingRevision) {
        await tx.contentVersion.create({
          data: {
            contentId: content.id,
            channel,
            versionType: "revised",
            titleCandidates: null,
            bodyMd: patch.revised_md,
            bodyHtml: patch.revised_html,
            meta: patch.meta ?? null,
          },
        });
      }

      const report = patch.report ?? { risk_score: 0, summary: "", issues: [] };
      const existingReport = await tx.complianceReport.findUnique({
        where: { contentId_channel: { contentId: content.id, channel } },
      });
      if (!existingReport) {
        await tx.complianceReport.create({
          data: {
            contentId: content.id,
            channel,
            riskScore: report.risk_score ?? 0,
            summary: report.summary ?? "",
            issues: report.issues ?? [],
          },
        });
      }

      const revisedChannels = await tx.contentVersion.findMany({
        where: { contentId: content.id, versionType: "revised" },
        select: { channel: true },
      });
      const allRevised = CHANNELS.every((ch) => revisedChannels.some((v) => v.channel === ch));
      const targetStatus: ContentStatus = allRevised ? "revised" : "drafted";
      if (content.status !== targetStatus) {
        await tx.content.update({ where: { id: content.id }, data: { status: targetStatus } });
      }
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
