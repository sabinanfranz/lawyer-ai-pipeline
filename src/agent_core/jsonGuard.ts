import { debugLog, isDebugEnabled } from "./debug";
import { safePreview, redactSecrets } from "./logSafe";
import type { z } from "zod";

function stripCodeFences(text: string): string {
  // ```json ... ``` 제거
  return text.replace(/```[\s\S]*?```/g, (m) => m.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, ""));
}

function extractJsonSlice(text: string): string | null {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s >= 0 && e > s) return text.slice(s, e + 1);
  return null;
}

type ParseResult = { data: unknown | null; error?: string };

function tryParseLoose(raw: string): ParseResult {
  const cleaned = stripCodeFences(raw).trim();
  const slice = extractJsonSlice(cleaned) ?? cleaned;

  try {
    return { data: JSON.parse(slice) };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function jsonGuard<T>(args: {
  raw: string;
  schema: z.ZodType<T>;
  repair: (p: { raw: string; error: string; attempt: number }) => Promise<string>;
  fallback: () => T;
  maxRepairAttempts?: number; // default 2
}): Promise<{ data: T; used_fallback: boolean; repaired: boolean; repair_attempts: number }> {
  const max = args.maxRepairAttempts ?? 2;

  // 1) parse + validate
  const parsed0 = tryParseLoose(args.raw);
  const parseOk0 = parsed0.data != null;
  debugLog("JSON_GUARD", `parse_ok=${parseOk0}`);
  if (!parseOk0 && isDebugEnabled()) {
    const pv = safePreview(redactSecrets(args.raw));
    // eslint-disable-next-line no-console
    console.log("[JSON_GUARD] parse_failed", {
      error: parsed0.error ?? "UNKNOWN_PARSE_ERROR",
      raw_len: pv.len,
      raw_head: pv.head,
      raw_tail: pv.tail,
    });
  }
  if (parseOk0) {
    const v0 = args.schema.safeParse(parsed0.data);
    debugLog(
      "JSON_GUARD",
      `schema_ok=${v0.success}`,
      v0.success ? undefined : summarizeZodIssues(v0.error)
    );
    if (v0.success) {
      return { data: v0.data, used_fallback: false, repaired: false, repair_attempts: 0 };
    }
  }

  // 2) repair loop
  let lastRaw = args.raw;
  for (let attempt = 1; attempt <= max; attempt++) {
    debugLog("JSON_GUARD", `repair_attempt=${attempt} start`);
    const errMsg = "JSON_PARSE_OR_SCHEMA_VALIDATE_FAILED";
    const repairedText = await args.repair({ raw: lastRaw, error: errMsg, attempt }).catch(() => "");
    if (isDebugEnabled()) {
      const pv = safePreview(redactSecrets(repairedText ?? ""));
      // eslint-disable-next-line no-console
      console.log(`[JSON_GUARD] repair_attempt=${attempt} output_preview`, {
        output_type: typeof repairedText,
        output_len: pv.len,
        output_head: pv.head,
        output_tail: pv.tail,
      });
    }
    if (!repairedText || !repairedText.trim()) {
      debugLog("JSON_GUARD", `repair_attempt=${attempt} empty_output`);
      continue;
    }

    const parsed = tryParseLoose(repairedText);
    const parseOk = parsed.data != null;
    debugLog("JSON_GUARD", `repair_attempt=${attempt} parse_ok=${parseOk}`);
    if (!parseOk) {
      if (isDebugEnabled()) {
        const pv = safePreview(redactSecrets(repairedText));
        // eslint-disable-next-line no-console
        console.log(`[JSON_GUARD] repair_attempt=${attempt} parse_failed`, {
          error: parsed.error ?? "UNKNOWN_PARSE_ERROR",
          raw_len: pv.len,
          raw_head: pv.head,
          raw_tail: pv.tail,
        });
      }
      lastRaw = repairedText;
      continue;
    }

    const v = args.schema.safeParse(parsed.data);
    debugLog(
      "JSON_GUARD",
      `repair_attempt=${attempt} schema_ok=${v.success}`,
      v.success ? undefined : summarizeZodIssues(v.error)
    );
    if (v.success) {
      return { data: v.data, used_fallback: false, repaired: true, repair_attempts: attempt };
    }

    lastRaw = repairedText;
  }

  // 3) fallback
  debugLog("JSON_GUARD", "fallback_used=true", { repair_attempts: max });
  return { data: args.fallback(), used_fallback: true, repaired: false, repair_attempts: max };
}

function summarizeZodIssues(error: z.ZodError): string {
  const summary = error.issues
    .map((i) => {
      const path = i.path.length ? `path=${i.path.join(".")}` : "";
      return [i.message, path].filter(Boolean).join(" ");
    })
    .join("; ");
  const max = 500;
  return summary.length > max ? `${summary.slice(0, max)}...` : summary;
}
