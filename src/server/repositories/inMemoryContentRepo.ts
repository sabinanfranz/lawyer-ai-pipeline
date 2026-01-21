import type { ContentRecord, ContentRepo } from "./contentRepo";

type Store = Map<string, ContentRecord>;

function getGlobalStore(): Store {
  const g = globalThis as unknown as { __contentStore?: Store };
  if (!g.__contentStore) g.__contentStore = new Map<string, ContentRecord>();
  return g.__contentStore;
}

export class InMemoryContentRepo implements ContentRepo {
  private store = getGlobalStore();

  async create(record: ContentRecord): Promise<void> {
    this.store.set(record.shareId, record);
  }

  async get(shareId: string): Promise<ContentRecord | null> {
    return this.store.get(shareId) ?? null;
  }

  async setRevised(
    shareId: string,
    patch: { revised_md: string; revised_html: string; report: ContentRecord["compliance_report"] }
  ): Promise<ContentRecord | null> {
    const cur = this.store.get(shareId);
    if (!cur) return null;

    // idempotent: 이미 있으면 그대로 반환
    if (cur.revised && cur.compliance_report) return cur;

    const next: ContentRecord = {
      ...cur,
      status: "revised",
      updatedAt: cur.updatedAt,
      revised: { revised_md: patch.revised_md, revised_html: patch.revised_html },
      compliance_report: patch.report ?? { risk_score: 0, summary: "", issues: [] },
    };

    this.store.set(shareId, next);
    return next;
  }
}
