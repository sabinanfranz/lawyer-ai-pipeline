import { DraftRawV1 } from "@/shared/contentTypes.vnext";

export type DraftParseMode = "json" | "text" | "coerced_text" | "empty";

export type CoercedDraftRaw = {
  draft: DraftRawV1;
  parse_mode: DraftParseMode;
  output_chars: number;
};

function stripCodeFences(s: string): string {
  const t = s.trim();
  const m1 = t.match(/```json\s*([\s\S]*?)\s*```/i);
  if (m1?.[1]) return m1[1].trim();
  const m2 = t.match(/```\s*([\s\S]*?)\s*```/);
  if (m2?.[1]) return m2[1].trim();
  return t;
}

function tryParseJsonLoose(s: string): unknown | null {
  const t = stripCodeFences(s);

  if (t.startsWith("{") && t.endsWith("}")) {
    try {
      return JSON.parse(t);
    } catch {
      /* noop */
    }
  }

  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    const candidate = t.slice(i, j + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      /* noop */
    }
  }

  return null;
}

function pickString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickStringArray(obj: any, keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const out = v.map((x) => x.trim()).filter(Boolean);
      if (out.length) return out;
    }
  }
  return undefined;
}

export function coerceDraftRaw(
  outputText: string,
  opts?: { fallbackDraftMd?: string }
): CoercedDraftRaw {
  const raw = (outputText ?? "").trim();
  const output_chars = raw.length;

  const fallbackDraftMd =
    opts?.fallbackDraftMd ?? "(초안 생성 결과가 비어있습니다. 다시 시도해 주세요.)";

  if (!raw) {
    return {
      draft: { draft_md: fallbackDraftMd },
      parse_mode: "empty",
      output_chars,
    };
  }

  const parsed = tryParseJsonLoose(raw);
  if (parsed && typeof parsed === "object") {
    const draft_md =
      pickString(parsed, ["draft_md", "body_md", "content", "text"]) ??
      pickString((parsed as any).draft, ["draft_md", "body_md", "content", "text"]);

    if (draft_md) {
      return {
        draft: {
          draft_md,
          title_candidates: pickStringArray(parsed, ["title_candidates", "titles"]),
          raw_json: parsed,
        },
        parse_mode: "json",
        output_chars,
      };
    }

    return {
      draft: { draft_md: raw, raw_json: parsed },
      parse_mode: "coerced_text",
      output_chars,
    };
  }

  return {
    draft: { draft_md: raw },
    parse_mode: "text",
    output_chars,
  };
}
