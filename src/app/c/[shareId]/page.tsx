"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Loader } from "@/components/ui/Loader";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { ContentRecord } from "@/server/repositories/contentRepo";

export default function ContentSharePage({ params }: { params: { shareId: string } }) {
  const shareId = params.shareId;
  const [data, setData] = useState<ContentRecord | null>(null);
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
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${shareId}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error?.message ?? j?.error ?? "콘텐츠를 찾을 수 없습니다.";
        throw new Error(msg);
      }
      const data = (j?.data ?? j) as ContentRecord;
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
      const updated = (j?.data ?? j) as ContentRecord;
      setData(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setApproving(false);
    }
  }

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
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Draft (읽기 전용)</div>
                <div className="text-xs text-gray-600">복사해서 네이버 블로그 편집기에 붙여넣으세요.</div>
              </div>
              <div className="flex gap-2">
                <CopyButton text={data.draft.body_md} label="복사(MD)" />
                <CopyButton text={data.draft.body_html} label="복사(HTML)" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold">제목 후보</div>
              <ul className="list-disc ml-5 text-sm mt-1">
                {data.draft.title_candidates.map((t, i) => (
                  <li key={`${t}-${i}`}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold">본문(Markdown 미리보기)</div>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{data.draft.body_md}</pre>
            </div>
          </Card>

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

          {data.revised && data.compliance_report && (
            <>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Revised (1회 수정본)</div>
                    <div className="text-xs text-gray-600">승인 후 생성된 수정본입니다.</div>
                  </div>
                  <div className="flex gap-2">
                    <CopyButton text={data.revised.revised_md} label="복사(MD)" />
                    <CopyButton text={data.revised.revised_html} label="복사(HTML)" />
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{data.revised.revised_md}</pre>
              </Card>

              <Card>
                <div className="font-semibold">Compliance Report</div>
                <div className="text-sm mt-2">
                  Risk score: <span className="font-semibold">{data.compliance_report.risk_score}</span>
                </div>
                <div className="text-sm text-gray-700 mt-2">{data.compliance_report.summary}</div>

                <div className="mt-3 space-y-2">
                  {data.compliance_report.issues.map((it, idx) => (
                    <div key={idx} className="rounded border p-3">
                      <div className="text-sm font-semibold">{it.category}</div>
                      <div className="text-sm mt-1">
                        <span className="font-semibold">문장:</span> {it.snippet}
                      </div>
                      <div className="text-sm mt-1">
                        <span className="font-semibold">이유:</span> {it.reason}
                      </div>
                      <div className="text-sm mt-1">
                        <span className="font-semibold">대체:</span> {it.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </main>
  );
}
