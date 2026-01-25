import { describe, it, expect } from "vitest";
import { normalizeMdLines } from "./mdNormalize";

describe("normalizeMdLines", () => {
  it("adds blank lines around headings and between list and paragraph", () => {
    const input = ["## TL;DR", "- 항목1", "- 항목2", "다음 문단입니다.", "두번째 문장입니다."];
    const out = normalizeMdLines(input);
    const md = out.join("\n");

    expect(md).toContain("## TL;DR\n\n- 항목1\n- 항목2\n\n다음 문단입니다.");
  });

  it("splits embedded newlines and keeps output as line-array", () => {
    const input = ["문단1\n문단2", "## 소제목\n- 리스트"];
    const out = normalizeMdLines(input);

    for (const l of out) {
      expect(l.includes("\n")).toBe(false);
    }
  });

  it("paragraph run is broken with blank lines (anti-wall-of-text)", () => {
    const input = ["문장A", "문장B", "문장C", "문장D"];
    const out = normalizeMdLines(input);
    const md = out.join("\n");

    expect(md).toContain("문장A\n문장B\n\n문장C\n문장D");
  });
});
