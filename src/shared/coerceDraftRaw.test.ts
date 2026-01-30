import { describe, it, expect } from "vitest";
import { coerceDraftRaw } from "./coerceDraftRaw";

const fallbackText = "(fallback)";

describe("coerceDraftRaw", () => {
  it("handles plain text", () => {
    const out = coerceDraftRaw("hello world", { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe("hello world");
  });

  it("extracts draft_md from JSON draft_md", () => {
    const raw = JSON.stringify({ draft_md: "MD content" });
    const out = coerceDraftRaw(raw, { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe("MD content");
  });

  it("extracts draft_md from JSON body_md", () => {
    const raw = JSON.stringify({ body_md: "Body MD" });
    const out = coerceDraftRaw(raw, { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe("Body MD");
  });

  it("extracts draft_md from JSON content", () => {
    const raw = JSON.stringify({ content: "Main text" });
    const out = coerceDraftRaw(raw, { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe("Main text");
  });

  it("falls back to raw text when JSON parse fails", () => {
    const raw = "{ not json";
    const out = coerceDraftRaw(raw, { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe(raw.trim());
  });

  it("uses fallback text when empty", () => {
    const out = coerceDraftRaw("   ", { fallbackDraftMd: fallbackText });
    expect(out.draft.draft_md).toBe(fallbackText);
  });
});
