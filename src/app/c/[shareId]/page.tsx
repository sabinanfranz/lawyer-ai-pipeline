"use client";

import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { ContentRecord, ContentRecordMulti } from "@/server/repositories/contentRepo";
import { CHANNEL_ORDER, CHANNEL_LABEL, type Channel } from "@/shared/channel";
import { useTopBar } from "@/components/topbar/TopBarContext";
import { useRouter } from "next/navigation";
import { DraftViewer } from "@/components/DraftViewer";
import { EMPTY_DRAFT, type Draft } from "@/shared/contentTypes.vnext";

const PREFILL_KEY = "WAL_PREFILL_INTAKE";

export default function ContentSharePage({ params }: { params: Promise<{ shareId: string }> }) {
  // Next 15+ client components receive params as a Promise; unwrap via React.use
  const { shareId } = React.use(params);
  const router = useRouter();
  const { setTopBarConfig } = useTopBar();
  const [data, setData] = useState<ContentRecordMulti | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 승인 체크박스(UX용)
  const [checks, setChecks] = useState({
    no_identifying: false,
    no_superlatives: false,
    no_guarantee: false,
    disclaimer_ok: false,
  });

  async function fetchContent() {
    if (!shareId || shareId === "undefined") {
      setError("유효하지 않은 링크입니다.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${shareId}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error?.message ?? j?.error ?? "콘텐츠를 찾을 수 없습니다.";
        throw new Error(msg);
      }
      const data = normalizeRecord(j?.data ?? j);
      setData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  async function approve() {
    if (!data) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${shareId}/approve`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error?.message ?? j?.error ?? "승인 처리 실패";
        throw new Error(msg);
      }
      const updated = normalizeRecord(j?.data ?? j);
      setData(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setApproving(false);
    }
  }

  const currentStep = useMemo<"drafts" | "review">(() => {
    if (!data) return "drafts";
    const hasReviewed =
      (data.compliance_reports && Object.keys(data.compliance_reports ?? {}).length > 0) ||
      (data.revised && Object.keys(data.revised ?? {}).length > 0) ||
      data.status === "revised";
    return hasReviewed ? "review" : "drafts";
  }, [data]);

  const handlePrefillStart = useCallback(() => {
    const intake = data?.intake;
    if (!intake) {
      router.push("/new");
      return;
    }
    try {
      localStorage.setItem(PREFILL_KEY, JSON.stringify(intake));
    } catch {
      // ignore storage errors
    }
    router.push("/new?prefill=1");
  }, [data, router]);

  useLayoutEffect(() => {
    const disabledAll = loading || approving || !data;
    setTopBarConfig({
      currentStep,
      disabledAll,
      actions: [
        { kind: "link", label: "새로 만들기", href: "/new", variant: "secondary" },
        {
          kind: "button",
          label: "이 조건으로 새로 시작",
          onClick: handlePrefillStart,
          variant: "secondary",
          disabled: !data?.intake,
        },
      ],
    });
  }, [setTopBarConfig, currentStep, loading, approving, data, handlePrefillStart]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">/c/{shareId}</h1>

      {loading && <Loader />}
      {error && <ErrorBanner message={error} />}
      {!loading && !data && (
        <Card>
          <div className="text-sm text-gray-700">콘텐츠가 없습니다. /new에서 생성해 주세요.</div>
        </Card>
      )}

      {data && (
        <>
          {CHANNEL_ORDER.map((ch) => {
            const draft = data.drafts?.[ch] ?? EMPTY_DRAFT;
            const draftText = pickDraftText(draft);
            const secondary = (draft.title_candidates ?? []).join("\n").trim();
            const revised = data.revised?.[ch];
            const revisedText = revised?.revised_md ?? "";

            return (
              <Card key={ch}>
                <DraftViewer
                  label={`${CHANNEL_LABEL[ch]} Draft`}
                  text={draftText}
                  secondaryText={secondary || undefined}
                />

                {revised && (
                  <div className="mt-6 border-t pt-4">
                    <DraftViewer label={`${CHANNEL_LABEL[ch]} Revised`} text={revisedText} />
                  </div>
                )}

                {data.compliance_reports?.[ch] && (
                  <div className="mt-6 border-t pt-4">
                    <div className="font-semibold">Compliance Report</div>
                    <div className="text-sm mt-2">
                      Risk score: <span className="font-semibold">{data.compliance_reports[ch]?.risk_score}</span>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">{data.compliance_reports[ch]?.summary}</div>

                    <div className="mt-3 space-y-2">
                      {(data.compliance_reports[ch]?.issues ?? []).map((it, idx) => (
                        <div key={idx} className="rounded border p-3">
                          {it.category && <div className="text-sm font-semibold">{it.category}</div>}
                          {it.snippet && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold">문장:</span> {it.snippet}
                            </div>
                          )}
                          {it.reason && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold">이유:</span> {it.reason}
                            </div>
                          )}
                          {it.suggestion && (
                            <div className="text-sm mt-1">
                              <span className="font-semibold">대체:</span> {it.suggestion}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          <Card>
            <div className="font-semibold">승인(HITL)</div>
            <div className="text-xs text-gray-600 mt-1">
              아래 체크는 “확인용”입니다. 승인 시 컴플라이언스 리뷰 후 1회 수정본이 생성됩니다.
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={checks.no_identifying}
                  onChange={(e) => setChecks((p) => ({ ...p, no_identifying: e.target.checked }))}
                />
                식별 가능한 의뢰인/사건 정보 없음
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={checks.no_superlatives}
                  onChange={(e) => setChecks((p) => ({ ...p, no_superlatives: e.target.checked }))}
                />
                최상급/‘전문’/과장 표현 없음
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={checks.no_guarantee}
                  onChange={(e) => setChecks((p) => ({ ...p, no_guarantee: e.target.checked }))}
                />
                결과 보장/승소율 암시 없음
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={checks.disclaimer_ok}
                  onChange={(e) => setChecks((p) => ({ ...p, disclaimer_ok: e.target.checked }))}
                />
                디스클레이머 포함 확인
              </label>
            </div>

            <div className="mt-4">
              <Button disabled={approving} onClick={approve}>
                {approving ? "처리 중..." : "승인하고 컴플라이언스 리뷰/수정본 받기"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
function normalizeRecord(raw: any): ContentRecordMulti {
  const isMulti = raw && typeof raw === "object" && "drafts" in raw;
  if (!isMulti) {
    const single = raw as ContentRecord;
    const drafts: Partial<Record<Channel, any>> = single?.draft ? { naver: single.draft } : {};
    const revised = single?.revised ? { naver: single.revised } : undefined;
    const reports = single?.compliance_report ? { naver: single.compliance_report } : undefined;
    raw = single
      ? {
          shareId: single.shareId,
          status: single.status,
          createdAt: single.createdAt,
          updatedAt: single.updatedAt,
          intake: single.intake,
          topic_candidates: single.topic_candidates,
          selected_candidate: single.selected_candidate,
          drafts,
          revised,
          compliance_reports: reports,
        }
      : raw;
  }

  const drafts: Record<Channel, Draft> = {} as any;
  CHANNEL_ORDER.forEach((ch) => {
    drafts[ch] = normalizeDraft(raw?.drafts?.[ch]);
  });

  return {
    ...raw,
    drafts,
    revised: raw?.revised,
    compliance_reports: raw?.compliance_reports,
  } as ContentRecordMulti;
}

function normalizeDraft(d: any): Draft {
  if (!d) return EMPTY_DRAFT;
  const md = pickDraftText(d);
  return {
    draft_md: md,
    title_candidates: d.title_candidates ?? [],
    body_html: d.body_html ?? null,
    body_md: d.body_md ?? md,
    body_md_lines: Array.isArray(d.body_md_lines) ? d.body_md_lines : [md],
  };
}

function pickDraftText(d: any): string {
  if (!d) return "";
  if (typeof d.draft_md === "string" && d.draft_md.trim()) return d.draft_md;
  if (typeof d.body_md === "string" && d.body_md.trim()) return d.body_md;
  if (Array.isArray(d.body_md_lines)) return d.body_md_lines.join("\n");
  return "";
}

// DraftBlock removed in PR3 (DraftViewer now renders all channels uniformly)
