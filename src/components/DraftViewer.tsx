"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

export type DraftViewerProps = {
  label: string;
  text: string;
  secondaryText?: string;
  defaultCollapsed?: boolean;
};

export function DraftViewer({ label, text, secondaryText, defaultCollapsed = true }: DraftViewerProps) {
  const display = (text ?? "").trim();
  const [showSecondary, setShowSecondary] = useState(!defaultCollapsed);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-gray-600">생성된 텍스트를 그대로 보여줍니다.</div>
        </div>
        <div className="flex gap-2">
          <CopyButton text={display || ""} label="복사" />
        </div>
      </div>

      <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm min-h-[96px]">{display || "(생성된 초안이 없습니다)"}</pre>

      {secondaryText && secondaryText.trim() && (
        <div className="rounded border p-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>제목 후보</span>
            <Button type="button" onClick={() => setShowSecondary((v) => !v)}>
              {showSecondary ? "접기" : "펼치기"}
            </Button>
          </div>
          {showSecondary && (
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{secondaryText}</pre>
          )}
        </div>
      )}
    </div>
  );
}
