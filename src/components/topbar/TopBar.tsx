"use client";

import Link from "next/link";
import React from "react";
import { useTopBar, type TopBarAction, type TopBarStep } from "./TopBarContext";

function cx(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

const STEPS: Array<{ key: TopBarStep; label: string }> = [
  { key: "intake", label: "입력" },
  { key: "candidates", label: "후보" },
  { key: "drafts", label: "초안" },
  { key: "review", label: "검수" },
];

function getBtnClass(variant: "primary" | "secondary" | "ghost" = "secondary", disabled?: boolean) {
  return cx(
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors",
    "border",
    variant === "primary" && "bg-foreground text-background border-foreground",
    variant === "secondary" && "bg-background text-foreground border-border",
    variant === "ghost" && "bg-transparent text-foreground border-transparent hover:bg-muted",
    !disabled && variant !== "primary" && "hover:bg-muted",
    disabled && "opacity-50 pointer-events-none"
  );
}

function ActionItem({ action, disabledAll }: { action: TopBarAction; disabledAll: boolean }) {
  const disabled = disabledAll || !!action.disabled;

  if (action.kind === "link") {
    return (
      <Link
        href={disabled ? "#" : action.href}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (action.confirmText) {
            const ok = window.confirm(action.confirmText);
            if (!ok) e.preventDefault();
          }
        }}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={getBtnClass(action.variant ?? "secondary", disabled)}
      >
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (action.confirmText) {
          const ok = window.confirm(action.confirmText);
          if (!ok) return;
        }
        action.onClick();
      }}
      className={getBtnClass(action.variant ?? "secondary", disabled)}
    >
      {action.label}
    </button>
  );
}

export default function TopBar() {
  const { config } = useTopBar();
  const { currentStep, actions, disabledAll } = config;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          {disabledAll ? (
            <span className="select-none font-semibold tracking-tight text-foreground opacity-60">WAL</span>
          ) : (
            <Link
              href="/new"
              className="font-semibold tracking-tight text-foreground hover:opacity-80"
              aria-label="처음으로 이동"
            >
              WAL
            </Link>
          )}
        </div>

        <nav aria-label="진행 단계" className="hidden sm:block">
          <ol className="flex items-center text-sm">
            {STEPS.map((s, idx) => {
              const isCurrent = s.key === currentStep;
              return (
                <li key={s.key} className="flex items-center">
                  <span
                    aria-current={isCurrent ? "step" : undefined}
                    className={cx("rounded px-2 py-1", isCurrent ? "bg-muted text-foreground font-medium" : "text-muted-foreground")}
                  >
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">›</span>}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex items-center justify-end gap-2">
          {actions.map((a, i) => (
            <ActionItem key={`${a.label}-${i}`} action={a} disabledAll={disabledAll} />
          ))}
        </div>
      </div>
    </header>
  );
}
