"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Loader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useTopBar } from "@/components/topbar/TopBarContext";

import {
  INDUSTRIES,
  TARGET_ROLES,
  ISSUE_STAGES,
  CONTENT_GOALS,
  OFFER_MATERIALS,
} from "@/lib/constants/options";
import { PAIN_PICKER_OPTIONS, type PainPickerId } from "@/lib/constants/painPicker";
import { SAFETY_NOTICE_LINES } from "@/lib/constants/safetyText";
import type { IntakeInput } from "@/lib/schemas/intake";
import type { TopicCandidatesResponse, TopicCandidate } from "@/agents/topicCandidates/schema";

type Step = 1 | 2;

const PREFILL_KEY = "WAL_PREFILL_INTAKE";
const DEFAULT_INTAKE: IntakeInput = {
  industry: INDUSTRIES[0],
  target_role: TARGET_ROLES[0],
  issue_stage: ISSUE_STAGES[0],
  pain_picker: [],
  content_goal: CONTENT_GOALS[0],
  offer_material: OFFER_MATERIALS[0],
  pain_sentence: "",
  experience_seed: "",
  must_avoid: "",
};

export default function NewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTopBarConfig } = useTopBar();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"candidates" | "drafts" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefillNotice, setPrefillNotice] = useState(false);

  const [intake, setIntake] = useState<IntakeInput>(DEFAULT_INTAKE);

  const [topicCandidates, setTopicCandidates] = useState<TopicCandidatesResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [candidatesIntakeSnapshot, setCandidatesIntakeSnapshot] = useState<IntakeInput | null>(null);
  const hasSelection = selectedCandidateId !== null;
  const prefillAppliedRef = useRef(false);

  const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
  const isSelected = (id: number) => selectedCandidateId === id;
  const cardClass = (id: number) => {
    const selected = isSelected(id);
    return cx(
      "w-full text-left transition-all duration-150 rounded-lg",
      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
      !hasSelection && "hover:shadow-sm hover:ring-1 hover:ring-primary/30",
      hasSelection && selected && "ring-2 ring-primary border border-primary bg-primary/5 shadow-sm",
      hasSelection && !selected && "opacity-45 grayscale hover:opacity-80 hover:grayscale-0"
    );
  };

  const groupedPain = useMemo(() => {
    const map = new Map<string, Array<{ id: PainPickerId; label: string }>>();
    for (const opt of PAIN_PICKER_OPTIONS) {
      const arr = map.get(opt.group) ?? [];
      arr.push({ id: opt.id, label: opt.label });
      map.set(opt.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  function togglePain(id: PainPickerId) {
    setIntake((prev) => {
      const exists = prev.pain_picker.includes(id);
      if (exists) return { ...prev, pain_picker: prev.pain_picker.filter((x) => x !== id) };
      if (prev.pain_picker.length >= 2) return prev; // max2
      return { ...prev, pain_picker: [...prev.pain_picker, id] };
    });
  }

  const handleResetIntake = useCallback(() => {
    setIntake(DEFAULT_INTAKE);
    setError(null);
  }, []);

  const handleEditInput = useCallback(() => {
    setStep(1);
  }, []);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setIntake(DEFAULT_INTAKE);
    setTopicCandidates(null);
    setSelectedCandidateId(null);
    setError(null);
    setCandidatesIntakeSnapshot(null);
  }, []);

  function isProbablyIntake(x: any): boolean {
    if (!x || typeof x !== "object") return false;
    if (typeof x.industry !== "string") return false;
    if (typeof x.target_role !== "string") return false;
    if (typeof x.issue_stage !== "string") return false;
    if (!Array.isArray(x.pain_picker)) return false;
    if (typeof x.content_goal !== "string") return false;
    if (typeof x.offer_material !== "string") return false;
    return true;
  }

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    const prefill = searchParams.get("prefill");
    if (prefill !== "1") return;

    prefillAppliedRef.current = true;

    try {
      const raw = localStorage.getItem(PREFILL_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!isProbablyIntake(parsed)) return;

      setIntake(parsed);
      setStep(1);
      setTopicCandidates(null);
      setSelectedCandidateId(null);
      setCandidatesIntakeSnapshot(null);
      setError(null);
      setPrefillNotice(true);
    } catch {
      // ignore parse/storage errors
    } finally {
      try {
        localStorage.removeItem(PREFILL_KEY);
      } catch {
        // ignore
      }
      router.replace("/new");
    }
  }, [searchParams, router]);

  async function generateCandidates() {
    setError(null);
    setLoading(true);
    setLoadingStage("candidates");
    try {
      const res = await fetch("/api/topic-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error?.message ?? j?.error ?? "주제 후보 생성 실패";
        throw new Error(msg);
      }

      const data = (j?.data ?? j) as TopicCandidatesResponse;
      setTopicCandidates(data);
      setSelectedCandidateId(null);
      setStep(2);
      setCandidatesIntakeSnapshot(JSON.parse(JSON.stringify(intake)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  }

  async function createDraft() {
    if (!topicCandidates || selectedCandidateId == null) return;

    setError(null);
    setLoading(true);
    setLoadingStage("drafts");
    try {
      const selected = topicCandidates.candidates.find((c) => c.id === selectedCandidateId) as TopicCandidate | undefined;
      if (!selected) throw new Error("선택한 후보를 찾을 수 없습니다.");

      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake,
          topic_candidates: topicCandidates,
          selected_candidate: selected,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const msg = j?.error?.message ?? j?.error ?? "초안 생성 실패";
        throw new Error(msg);
      }

      const { shareId } = (j?.data ?? j) as { shareId: string };
      router.push(`/c/${shareId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  }

  const loadingTitle =
    loadingStage === "candidates"
      ? "주제 후보를 만드는 중입니다"
      : loadingStage === "drafts"
      ? "초안을 생성하는 중입니다"
      : "처리 중입니다";

  const loadingDesc =
    loadingStage === "candidates"
      ? "입력 내용을 바탕으로 7개 후보를 생성하고 있어요. 완료되면 자동으로 다음 단계로 이동합니다."
      : loadingStage === "drafts"
      ? "선택한 주제로 네이버/LinkedIn/Threads 초안을 만들고 있어요. 완료되면 자동으로 이동합니다."
      : "잠시만 기다려 주세요.";

  const intakeDirty = useMemo(() => JSON.stringify(intake) !== JSON.stringify(DEFAULT_INTAKE), [intake]);
  const isChangedSinceCandidates = useMemo(() => {
    if (!candidatesIntakeSnapshot) return false;
    return JSON.stringify(intake) !== JSON.stringify(candidatesIntakeSnapshot);
  }, [intake, candidatesIntakeSnapshot]);

  useLayoutEffect(() => {
    if (step === 1) {
      setTopBarConfig({
        currentStep: "intake",
        disabledAll: loading,
        actions: [
          {
            kind: "button",
            label: "초기화",
            onClick: handleResetIntake,
            variant: "secondary",
            confirmText: intakeDirty ? "입력 내용을 초기화할까요?" : undefined,
          },
        ],
      });
      return;
    }

    setTopBarConfig({
      currentStep: "candidates",
      disabledAll: loading,
      actions: [
        {
          kind: "button",
          label: "입력 수정",
          onClick: handleEditInput,
          variant: "secondary",
        },
        {
          kind: "button",
          label: "처음부터",
          onClick: handleStartOver,
          variant: "secondary",
          confirmText: "처음부터 다시 진행할까요? 생성된 후보 목록이 사라집니다.",
        },
      ],
    });
  }, [step, loading, intakeDirty, handleResetIntake, handleEditInput, handleStartOver, setTopBarConfig]);

  return (
    <main className="p-6 space-y-4">
      {loading && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center"
          aria-busy="true"
        >
          <div className="w-[min(560px,92vw)] rounded-xl border bg-background p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <Loader />
              <div className="flex-1">
                <p className="text-base font-semibold">{loadingTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground" role="status">
                  {loadingDesc}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="indeterminate-bar h-full w-1/3 rounded-full bg-primary" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              ※ 창이 멈춘 것이 아니라 작업 중입니다. 완료되면 자동으로 진행됩니다.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-xl font-semibold">/new</h1>

      <Card>
        <div className="space-y-1 text-sm text-gray-700">
          {SAFETY_NOTICE_LINES.map((line) => (
            <div key={line}>• {line}</div>
          ))}
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading && <Loader />}

      {step === 1 && (
        <Card>
          {prefillNotice && (
            <div className="mb-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              이전 조건을 불러왔습니다. 필요하면 수정 후{" "}
              <span className="font-medium text-foreground">‘주제 후보 만들기’</span>를 눌러 진행해 주세요.
            </div>
          )}

          <h2 className="font-semibold mb-4">Step 1) 입력</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              업종(industry) *
              <select
                className="mt-1 w-full border rounded p-2"
                value={intake.industry}
                onChange={(e) => setIntake((p) => ({ ...p, industry: e.target.value as any }))}
              >
                {INDUSTRIES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-600 mt-1">어느 업종이든 괜찮습니다. 모르면 ‘기타(모름)’ 선택하세요.</div>
            </label>

            <label className="text-sm">
              독자 역할(target_role) *
              <select
                className="mt-1 w-full border rounded p-2"
                value={intake.target_role}
                onChange={(e) => setIntake((p) => ({ ...p, target_role: e.target.value as any }))}
              >
                {TARGET_ROLES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-600 mt-1">이 글을 내부 공유할 ‘결정권자’가 누구인지 골라주세요.</div>
            </label>

            <label className="text-sm">
              이슈 단계(issue_stage) *
              <select
                className="mt-1 w-full border rounded p-2"
                value={intake.issue_stage}
                onChange={(e) => setIntake((p) => ({ ...p, issue_stage: e.target.value as any }))}
              >
                {ISSUE_STAGES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-600 mt-1">
                예방/진행/사후 중 어디인지 잡으면, 네이버 검색 의도에 맞춘 주제가 더 선명해집니다.
              </div>
            </label>

            <div className="text-sm">
              콘텐츠 목표(content_goal) * (단일)
              <div className="mt-2 space-y-1">
                {CONTENT_GOALS.map((x) => (
                  <label key={x} className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name="content_goal"
                      checked={intake.content_goal === x}
                      onChange={() => setIntake((p) => ({ ...p, content_goal: x }))}
                    />
                    <span>{x}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="text-sm">
              제공 자료(offer_material) * (단일)
              <div className="mt-2 space-y-1">
                {OFFER_MATERIALS.map((x) => (
                  <label key={x} className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name="offer_material"
                      checked={intake.offer_material === x}
                      onChange={() => setIntake((p) => ({ ...p, offer_material: x }))}
                    />
                    <span>{x}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 text-sm">
            <div className="font-semibold">고민 선택(pain_picker) * (최대 2개)</div>
            <div className="text-xs text-gray-600 mt-1">
              가장 아픈 것 1~2개만 선택하세요(많이 고르면 글이 산만해져요).
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {groupedPain.map(([group, items]) => (
                <div key={group} className="rounded border p-3">
                  <div className="font-semibold mb-2">{group}</div>
                  <div className="space-y-1">
                    {items.map((it) => {
                      const checked = intake.pain_picker.includes(it.id);
                      const disabled = !checked && intake.pain_picker.length >= 2;
                      return (
                        <label key={it.id} className={`flex gap-2 items-center ${disabled ? "opacity-50" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => togglePain(it.id)}
                          />
                          <span>{it.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              고민 1문장(pain_sentence) (선택)
              <input
                className="mt-1 w-full border rounded p-2"
                maxLength={200}
                value={intake.pain_sentence ?? ""}
                onChange={(e) => setIntake((p) => ({ ...p, pain_sentence: e.target.value }))}
                placeholder="예: 외주사 산출물 검수 기준 때문에 분쟁이 반복돼요."
              />
            </label>

            <label className="text-sm">
              현장 오해/실수 씨앗(experience_seed) (선택)
              <input
                className="mt-1 w-full border rounded p-2"
                maxLength={200}
                value={intake.experience_seed ?? ""}
                onChange={(e) => setIntake((p) => ({ ...p, experience_seed: e.target.value }))}
                placeholder="예: 계약서 없이 메일로만 진행하고 나중에 정산 싸움이 나요."
              />
            </label>

            <label className="text-sm md:col-span-2">
              피해야 할 표현(must_avoid) (선택)
              <input
                className="mt-1 w-full border rounded p-2"
                maxLength={160}
                value={intake.must_avoid ?? ""}
                onChange={(e) => setIntake((p) => ({ ...p, must_avoid: e.target.value }))}
                placeholder="예: 무료, 1위, 전문, 승소, 특정 회사명"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-2">
            <Button disabled={loading || intake.pain_picker.length === 0} onClick={generateCandidates}>
              {loadingStage === "candidates" ? "후보 생성 중..." : "주제 후보 만들기"}
            </Button>
          </div>

          {step === 1 && topicCandidates && candidatesIntakeSnapshot && isChangedSinceCandidates && (
            <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              입력을 변경하셨습니다. <span className="font-medium text-foreground">‘주제 후보 만들기’</span>를 다시 눌러야
              변경 내용이 후보에 반영됩니다.
            </div>
          )}
        </Card>
      )}

      {step === 2 && topicCandidates && (
        <Card>
          <h2 className="font-semibold mb-2">Step 2) 주제 후보 7개 + TOP3</h2>

          <div className="text-sm text-gray-700 mb-4">
            <div className="font-semibold">TOP3 추천</div>
            <ul className="list-disc ml-5">
              {topicCandidates.top3_recommendations.map((r) => (
                <li key={r.id}>
                  #{r.id} — {r.why}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3">
            {topicCandidates.candidates.map((c) => {
              const selected = isSelected(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cardClass(c.id)}
                  aria-pressed={selected}
                  aria-selected={selected}
                  onClick={() =>
                    setSelectedCandidateId((prev) => (prev === c.id ? null : c.id))
                  }
                >
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          #{c.id} {c.title_search}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{c.hook}</div>
                        <div className="text-xs text-gray-600 mt-2">
                          intent: {c.smartblock_intent} | role: {c.content_role} | keyword: {c.primary_keyword}
                        </div>
                      </div>
                      {selected && (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                          ✓ 선택됨
                        </span>
                      )}
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>

          {selectedCandidateId && (
            <div className="mt-3 text-sm text-gray-700">
              선택한 주제:{" "}
              <span className="font-semibold">
                {topicCandidates.candidates.find((c) => c.id === selectedCandidateId)?.title_search}
              </span>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button disabled={loading} onClick={() => setStep(1)}>
              ← 입력으로
            </Button>
            <Button disabled={loading || selectedCandidateId == null} onClick={createDraft}>
              {loadingStage === "drafts" ? "초안 생성 중..." : "이 주제로 네이버 글 생성"}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
