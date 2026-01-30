import { CHANNELS } from "@/shared/channel";
import type {
  ComplianceReportPayload,
  ContentMeta,
  ContentRecord,
  ContentRecordMulti,
  ContentRepo,
  DraftPayload,
  RevisedPayload,
} from "./contentRepo";
import { PRIMARY_CHANNEL } from "./contentRepo";
import type { Channel } from "@/shared/channel";
import { EMPTY_DRAFT } from "@/shared/contentTypes.vnext";

type VersionEntry = { draft?: DraftPayload; revised?: RevisedPayload };
type VersionsByChannel = Map<Channel, VersionEntry>;
type ReportsByChannel = Map<Channel, ComplianceReportPayload>;

type ContentRow = {
  shareId: string;
  status: "drafted" | "revised";
  createdAt: string;
  updatedAt: string;
  meta: ContentMeta;
};

type ContentStore = Map<string, ContentRow>;
type VersionStore = Map<string, VersionsByChannel>;
type ReportStore = Map<string, ReportsByChannel>;

function getGlobalStore<T>(key: "__contentStore" | "__versionStore" | "__reportStore", init: () => T): T {
  const g = globalThis as Record<string, unknown>;
  if (!g[key]) {
    g[key] = init();
  }
  return g[key] as T;
}

function ensureVersionMap(versionStore: VersionStore, contentId: string): VersionsByChannel {
  if (!versionStore.has(contentId)) {
    versionStore.set(contentId, new Map());
  }
  return versionStore.get(contentId)!;
}

function normalizeDraft(draft?: DraftPayload): DraftPayload {
  if (!draft) return { ...EMPTY_DRAFT };
  const draft_md = draft.draft_md ?? draft.body_md ?? "";
  return {
    ...draft,
    draft_md,
    body_md: draft.body_md ?? draft_md,
    body_md_lines: draft.body_md_lines ?? (draft_md ? [draft_md] : [""]),
    title_candidates: draft.title_candidates ?? [],
  };
}

function ensureReportMap(reportStore: ReportStore, contentId: string): ReportsByChannel {
  if (!reportStore.has(contentId)) {
    reportStore.set(contentId, new Map());
  }
  return reportStore.get(contentId)!;
}

export class InMemoryContentRepo implements ContentRepo {
  private contents = getGlobalStore<ContentStore>("__contentStore", () => new Map());
  private versions = getGlobalStore<VersionStore>("__versionStore", () => new Map());
  private reports = getGlobalStore<ReportStore>("__reportStore", () => new Map());

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

  async createContentWithDrafts(args: {
    shareId: string;
    status: "drafted" | "revised";
    createdAt?: string;
    updatedAt?: string;
    intake: ContentMeta["intake"];
    topic_candidates: ContentMeta["topic_candidates"];
    selected_candidate: ContentMeta["selected_candidate"];
    draftsByChannel: Partial<Record<Channel, DraftPayload>>;
    metaByChannel?: Partial<Record<Channel, any>>;
  }): Promise<void> {
    const row: ContentRow = {
      shareId: args.shareId,
      status: args.status,
      createdAt: args.createdAt ?? new Date().toISOString(),
      updatedAt: args.updatedAt ?? new Date().toISOString(),
      meta: {
        intake: args.intake,
        topic_candidates: args.topic_candidates,
        selected_candidate: args.selected_candidate,
      },
    };

    this.contents.set(args.shareId, row);
    const versionMap = ensureVersionMap(this.versions, args.shareId);

    Object.entries(args.draftsByChannel).forEach(([channel, draft]) => {
      const ch = channel as Channel;
      const entry = versionMap.get(ch) ?? {};
      entry.draft = normalizeDraft(draft);
      versionMap.set(ch, entry);
    });
    CHANNELS.forEach((ch) => {
      const entry = versionMap.get(ch) ?? {};
      if (!entry.draft) entry.draft = normalizeDraft(EMPTY_DRAFT);
      versionMap.set(ch, entry);
    });
  }

  async get(shareId: string): Promise<ContentRecord | null> {
    const multi = await this.getByShareIdMulti(shareId);
    if (!multi) return null;
    const pick = pickPrimary(multi.drafts) ?? firstAvailable(multi.drafts);
    if (!pick) return null;

    return {
      shareId: multi.shareId,
      status: multi.status,
      createdAt: multi.createdAt,
      updatedAt: multi.updatedAt,
      intake: multi.intake,
      topic_candidates: multi.topic_candidates,
      selected_candidate: multi.selected_candidate,
      draft: pick,
      revised: pickPrimary(multi.revised),
      compliance_report: normalizeSingleReport(pickPrimary(multi.compliance_reports)),
    };
  }

  async getByShareIdMulti(shareId: string): Promise<ContentRecordMulti | null> {
    const row = this.contents.get(shareId);
    if (!row) return null;

    const versionMap = this.versions.get(shareId) ?? new Map();
    const reportMap = this.reports.get(shareId) ?? new Map();

    const drafts: Partial<Record<Channel, DraftPayload>> = {};
    const revised: Partial<Record<Channel, RevisedPayload>> = {};
    CHANNELS.forEach((ch) => {
      const entry = versionMap.get(ch);
      drafts[ch] = entry?.draft ?? normalizeDraft(EMPTY_DRAFT);
      if (entry?.revised) revised[ch] = entry.revised;
    });

    const reports: Partial<Record<Channel, ComplianceReportPayload>> = {};
    CHANNELS.forEach((ch) => {
      const rep = reportMap.get(ch);
      if (rep) reports[ch] = rep;
    });

    return {
      shareId: row.shareId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      intake: row.meta.intake,
      topic_candidates: row.meta.topic_candidates,
      selected_candidate: row.meta.selected_candidate,
      drafts,
      revised: Object.keys(revised).length ? revised : undefined,
      compliance_reports: Object.keys(reports).length ? reports : undefined,
    };
  }

  async setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null> {
    const multi = await this.setRevisedByChannel(shareId, PRIMARY_CHANNEL, patch);
    if (!multi) return null;
    return (await this.get(shareId)) as ContentRecord | null;
  }

  async setRevisedByChannel(
    shareId: string,
    channel: Channel,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"]; meta?: any }
  ): Promise<ContentRecordMulti | null> {
    const row = this.contents.get(shareId);
    if (!row) return null;

    const versionMap = ensureVersionMap(this.versions, shareId);
    const reportMap = ensureReportMap(this.reports, shareId);

    const existingRevision = versionMap.get(channel)?.revised;
    const existingReport = reportMap.get(channel);
    if (existingRevision && existingReport) {
      return this.getByShareIdMulti(shareId);
    }

    const entry = versionMap.get(channel) ?? {};
    if (!existingRevision) {
      entry.revised = { revised_md: patch.revised_md, revised_html: patch.revised_html };
    }
    versionMap.set(channel, entry);

    if (!existingReport) {
      reportMap.set(channel, patch.report ?? { risk_score: 0, summary: "", issues: [] });
    }

    // status: revised only when 모든 채널 revised 존재
    const allRevised = CHANNELS.every((ch) => {
      const ent = versionMap.get(ch);
      return ent?.revised;
    });
    row.status = allRevised ? "revised" : "drafted";
    this.contents.set(shareId, row);

    return this.getByShareIdMulti(shareId);
  }
}

function pickPrimary<T>(byChannel?: Partial<Record<Channel, T>>): T | undefined {
  if (!byChannel) return undefined;
  return byChannel[PRIMARY_CHANNEL];
}

function firstAvailable<T>(byChannel?: Partial<Record<Channel, T>>): T | undefined {
  if (!byChannel) return undefined;
  const firstKey = Object.keys(byChannel)[0] as Channel | undefined;
  return firstKey ? byChannel[firstKey] : undefined;
}

function normalizeSingleReport(rep: any): ContentRecord["compliance_report"] {
  if (!rep) return undefined;
  const issuesRaw = Array.isArray(rep.issues) ? rep.issues : [];
  const issues = issuesRaw.map((it: any) => ({
    category: it?.category ?? "",
    snippet: it?.snippet ?? (Array.isArray(it?.matches) ? it.matches[0] ?? "" : ""),
    reason: it?.reason ?? "",
    suggestion: it?.suggestion ?? "",
  }));
  return {
    risk_score: rep.risk_score ?? 0,
    summary: rep.summary ?? "",
    issues,
  };
}
