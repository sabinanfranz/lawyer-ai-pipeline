import crypto from "node:crypto";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { InMemoryContentRepo } from "@/server/repositories/inMemoryContentRepo";
import type { ContentRepo } from "@/server/repositories/contentRepo";
import { CHANNELS } from "@/shared/channel";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

// Shared in-memory repo for route handlers (mocked getContentRepo)
const repo = new InMemoryContentRepo();
vi.mock("@/server/repositories", () => {
  return {
    getContentRepo: () => repo,
  };
});

const runAgentMock = vi.fn();
vi.mock("@/agent_core/orchestrator", () => ({
  runAgent: (...args: any[]) => runAgentMock(...args),
}));

function resetStores() {
  (globalThis as any).__contentStore?.clear?.();
  (globalThis as any).__versionStore?.clear?.();
  (globalThis as any).__reportStore?.clear?.();
}

const intake = {
  industry: "IT/SaaS",
  target_role: "CEO/대표",
  issue_stage: "예방",
  pain_picker: ["contract_outsourcing_breakdown"],
  content_goal: "신뢰 쌓기(초기 리드)",
  offer_material: "체크리스트",
  pain_sentence: "테스트 문장",
  experience_seed: "",
  must_avoid: "",
} as any;

const topicCandidates = (() => {
  const candidate = {
    id: 1,
    title_search: "검색",
    title_share: "공유",
    smartblock_intent: "reaction_response",
    content_role: "cluster",
    hook: "hook",
    risk_solved: "risk",
    format: "checklist",
    primary_keyword: "키워드",
    longtail_keywords: ["a", "b", "c"] as [string, string, string],
    deliverable: "deliv",
    cta_one: "cta",
    difficulty: "중",
    risk_level: "중",
    hitl_points: ["p1", "p2"] as [string, string],
  };
  return {
    normalized_brief: { persona_summary: "p", pain_summary: "p", assumptions: ["a1", "a2"] },
    candidates: Array.from({ length: 7 }, (_, i) => ({ ...candidate, id: i + 1 })),
    top3_recommendations: [
      { id: 1, why: "why1" },
      { id: 2, why: "why2" },
      { id: 3, why: "why3" },
    ],
  };
})();

const selectedCandidate = topicCandidates.candidates[0];

function draftFor(name: string) {
  return {
    title_candidates: [`${name} 제목1`, `${name} 제목2`, `${name} 제목3`],
    body_md: `${name} 본문`,
    body_html: `<p>${name} 본문</p>`,
  };
}

function revisedFor(name: string) {
  const md = `${name} 수정본\n\n일반 정보 제공 목적입니다.\n사안별로 달라질 수 있습니다.`;
  return {
    revised_md: md,
    revised_html: `<p>${md}</p>`,
    report: { risk_score: 10, summary: "ok", issues: [{ category: "test", snippet: "x", reason: "y", suggestion: "z" }] },
  };
}

beforeEach(() => {
  resetStores();
  runAgentMock.mockReset();
  runAgentMock.mockImplementation((agentName: string, input: any, overrides: any) => {
    if (agentName.startsWith("draft")) {
      return Promise.resolve({ ok: true, data: draftFor(agentName) });
    }
    if (agentName === "complianceRewrite") {
      const channel = overrides?.variant_key ?? "naver";
      return Promise.resolve({ ok: true, data: revisedFor(channel) });
    }
    throw new Error("unknown agent");
  });
});

async function callPostContent() {
  const { POST } = await import("@/app/api/content/route");
  const res = await POST(
    new Request("http://localhost/api/content", {
      method: "POST",
      body: JSON.stringify({
        intake,
        topic_candidates: topicCandidates,
        selected_candidate: selectedCandidate,
      }),
    })
  );
  const json = await res.json();
  return json.data?.shareId as string;
}

async function callGetContent(shareId: string) {
  const { GET } = await import("@/app/api/content/[shareId]/route");
  const res = await GET(new Request(`http://localhost/api/content/${shareId}`), {
    params: Promise.resolve({ shareId }),
  });
  return await res.json();
}

async function callApprove(shareId: string) {
  const { POST } = await import("@/app/api/content/[shareId]/approve/route");
  const res = await POST(new Request(`http://localhost/api/content/${shareId}/approve`, { method: "POST" }), {
    params: Promise.resolve({ shareId }),
  });
  return await res.json();
}

describe("API multichannel flows", () => {
  it("creates drafts for all channels and returns them", async () => {
    const shareId = await callPostContent();
    const getJson = await callGetContent(shareId);
    expect(getJson.ok).toBe(true);
    CHANNELS.forEach((ch) => {
      expect(getJson.data.drafts?.[ch]).toBeTruthy();
      expect(getJson.data.drafts[ch].body_md.length).toBeGreaterThan(0);
    });
  });

  it("uses prompt_version v3 for all draft agents", async () => {
    await callPostContent();
    const draftCalls = runAgentMock.mock.calls.filter((c) => c[0].startsWith("draft"));
    expect(draftCalls).toHaveLength(3);
    draftCalls.forEach((call) => {
      const overrides = call[2];
      expect(overrides?.prompt_version).toBe("v3");
    });
  });

  it("approve generates revised/report per channel and is idempotent", async () => {
    const shareId = await callPostContent();
    const beforeCalls = runAgentMock.mock.calls.length;
    const approve1 = await callApprove(shareId);
    expect(approve1.ok).toBe(true);
    CHANNELS.forEach((ch) => {
      expect(approve1.data.revised?.[ch]).toBeTruthy();
      expect(approve1.data.compliance_reports?.[ch]).toBeTruthy();
      expect(approve1.data.revised[ch].revised_md).toContain("정보 제공 목적");
    });
    const midCalls = runAgentMock.mock.calls.length;
    const approve2 = await callApprove(shareId);
    expect(approve2.ok).toBe(true);
    expect(runAgentMock.mock.calls.length).toBe(midCalls); // no additional rewrite calls
    expect(beforeCalls).toBeLessThan(midCalls); // draft calls happened
  });

  it("approve retries missing channels only after partial failure", async () => {
    const shareId = await callPostContent();
    const failOnce = new Set<Channel>(["linkedin", "threads"]);
    runAgentMock.mockImplementation((agentName: string, _input: any, overrides: any) => {
      if (agentName.startsWith("draft")) return Promise.resolve({ ok: true, data: draftFor(agentName) });
      if (agentName === "complianceRewrite") {
        const ch = overrides?.variant_key as Channel;
        if (failOnce.has(ch)) {
          failOnce.delete(ch);
          return Promise.reject(new Error("forced-fail-" + ch));
        }
        return Promise.resolve({ ok: true, data: revisedFor(ch) });
      }
      throw new Error("unknown agent");
    });

    const first = await callApprove(shareId);
    expect(first.ok).toBe(false); // some channel failed
    const afterFirst = await repo.getByShareIdMulti(shareId);
    expect(afterFirst?.revised?.naver).toBeTruthy(); // succeeded channel kept

    const second = await callApprove(shareId);
    expect(second.ok).toBe(true);
    CHANNELS.forEach((ch) => {
      expect(second.data.revised?.[ch]).toBeTruthy();
    });
  });
});
