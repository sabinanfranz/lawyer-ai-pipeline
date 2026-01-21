"use client";

import { useState } from "react";
import { Button } from "./Button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      // eslint-disable-next-line no-alert
      alert("복사에 실패했습니다. 클립보드 권한을 확인해주세요.");
    }
  }

  return <Button onClick={onCopy}>{copied ? "복사됨" : label}</Button>;
}
