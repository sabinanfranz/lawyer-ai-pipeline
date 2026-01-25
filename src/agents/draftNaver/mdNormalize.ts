export type MdLineKind = "blank" | "heading" | "list" | "quote" | "paragraph" | "other";

function rstrip(s: string) {
  return s.replace(/[ \t\u00A0]+$/g, "");
}

function kindOf(line: string): MdLineKind {
  const t = line.trim();
  if (!t) return "blank";
  if (/^#{2,3}\s+/.test(t)) return "heading";
  if (/^(-\s+|\d+[.)]\s+|•\s+)/.test(t)) return "list";
  if (/^>\s?/.test(t)) return "quote";
  return "paragraph";
}

function pushBlankOnce(out: string[]) {
  if (out.length === 0) return;
  if (out[out.length - 1] !== "") out.push("");
}

/**
 * normalizeMdLines
 * - 요소 내 \n을 분해하여 “진짜 라인 배열”로 만든다
 * - 소제목/리스트/인용구 전후에 빈 줄을 보장한다
 * - 연속 문단 라인이 너무 붙으면(특히 예전 포맷) 2줄 단위로 빈 줄을 넣어 문단화한다
 */
export function normalizeMdLines(input: string[] | undefined | null): string[] {
  const flat: string[] = [];

  for (const raw of input ?? []) {
    if (typeof raw !== "string") continue;
    const normalized = raw.replace(/\r\n/g, "\n");
    const parts = normalized.split("\n");
    for (const p of parts) flat.push(rstrip(p));
  }

  const out: string[] = [];
  let prevKind: MdLineKind = "blank";
  let paragraphRun = 0;

  for (let i = 0; i < flat.length; i++) {
    const line = flat[i] ?? "";
    const k = kindOf(line);
    const nextKind = kindOf(flat[i + 1] ?? "");

    if (out.length === 0 && k === "blank") continue;

    if ((prevKind === "list" || prevKind === "quote") && (k === "paragraph" || k === "heading")) {
      pushBlankOnce(out);
      paragraphRun = 0;
    }

    if (k === "blank") {
      paragraphRun = 0;
      pushBlankOnce(out);
      prevKind = "blank";
      continue;
    }

    if (k === "heading") {
      paragraphRun = 0;
      pushBlankOnce(out);
      out.push(line.trim());
      out.push("");
      prevKind = "heading";
      continue;
    }

    if (k === "list" || k === "quote") {
      if (prevKind !== "blank" && prevKind !== "list" && prevKind !== "quote") {
        pushBlankOnce(out);
      }
      out.push(line);
      paragraphRun = 0;
      prevKind = k;
      continue;
    }

    out.push(line);
    paragraphRun += 1;
    prevKind = "paragraph";

    const tooLong = line.length >= 180;
    const shouldBreak = tooLong || paragraphRun >= 2;

    if (shouldBreak && nextKind === "paragraph") {
      out.push("");
      paragraphRun = 0;
      prevKind = "blank";
    }
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  const collapsed: string[] = [];
  for (const l of out) {
    if (l === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(l);
  }
  return collapsed;
}
