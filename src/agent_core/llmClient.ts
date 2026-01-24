import { debugLog, isDebugEnabled } from "./debug";
import { safePreview, redactSecrets } from "./logSafe";
import { env } from "@/server/env";

export type LlmGenerateArgs = {
  system: string;
  user: string;
  temperature?: number;
  max_tokens?: number; // legacy compat (chat completions)
  max_tokens_override?: number; // optional override for either style
  run_id?: string;
};

export interface LlmClient {
  generateText(args: LlmGenerateArgs): Promise<string>;
}

type OpenAiApiStyle = "auto" | "chat" | "responses";

function isGpt5(model: string): boolean {
  return (model ?? "").toLowerCase().startsWith("gpt-5");
}

export class MockLlmClient implements LlmClient {
  async generateText(): Promise<string> {
    throw new Error("LLM_DISABLED");
  }
}

export class OpenAiClient implements LlmClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;
  private defaultTemp?: number;
  private maxCompletionTokens: number;
  private maxOutputTokens: number;
  private apiStyle: OpenAiApiStyle;

  constructor(args: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    defaultTemp?: number;
    maxCompletionTokens: number;
    maxOutputTokens: number;
    apiStyle: OpenAiApiStyle;
  }) {
    this.apiKey = args.apiKey;
    this.baseUrl = args.baseUrl.replace(/\/$/, "");
    this.model = args.model;
    this.timeoutMs = args.timeoutMs;
    this.defaultTemp = args.defaultTemp;
    this.maxCompletionTokens = args.maxCompletionTokens;
    this.maxOutputTokens = args.maxOutputTokens;
    this.apiStyle = args.apiStyle;
  }

  async generateText(args: LlmGenerateArgs): Promise<string> {
    const runId = args.run_id ?? "n/a";
    const style = this.pickStyle();
    const temp = typeof args.temperature === "number" ? args.temperature : this.defaultTemp;

    if (isDebugEnabled()) {
      debugLog(
        "LLM_CALL",
        `style=${style} model=${this.model} base=${this.baseUrl} timeout=${this.timeoutMs} max_tokens=${args.max_tokens_override ?? args.max_tokens ?? (style === "responses" ? this.maxOutputTokens : this.maxCompletionTokens)} temperature=${temp ?? "omitted"} run_id=${runId}`
      );
    }

    try {
      if (style === "responses") {
        return await this.generateViaResponses(args, runId);
      }
      return await this.generateViaChat(args, runId, temp);
    } catch (err) {
      if (isDebugEnabled()) {
        const message = err instanceof Error ? err.message : String(err);
        debugLog("LLM_ERR", `message="${message}"`, { run_id: runId });
      }
      throw err;
    }
  }

  private pickStyle(): Exclude<OpenAiApiStyle, "auto"> {
    if (this.apiStyle === "chat" || this.apiStyle === "responses") return this.apiStyle;
    return isGpt5(this.model) ? "responses" : "chat";
  }

  private async generateViaChat(args: LlmGenerateArgs, runId: string, temp?: number): Promise<string> {
    const initialMax = args.max_tokens_override ?? args.max_tokens ?? this.maxCompletionTokens;

    const doFetch = async (attempt: number, maxTok: number): Promise<string> => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(runId ? { "X-Client-Request-Id": runId } : {}),
          },
          signal: ac.signal,
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: "developer", content: args.system },
              { role: "user", content: args.user },
            ],
            max_completion_tokens: maxTok,
            ...(typeof temp === "number" ? { temperature: temp } : {}),
          }),
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`OPENAI_HTTP_${res.status}: ${text}`);
        }
        const json = JSON.parse(text);
        const choice0 = json?.choices?.[0];
        const content = choice0?.message?.content;
        const finish = choice0?.finish_reason ?? null;
        const usage = json?.usage ?? null;

        this.logOkMeta({
          runId,
          model: this.model,
          status: res.status,
          choicesLen: Array.isArray(json?.choices) ? json.choices.length : null,
          finishReason: finish,
          usage,
          content,
          rawJson: json,
        });

        const hasContent = typeof content === "string";
        const trimmed = hasContent ? content.trim() : "";
        const completionTokens = usage?.completion_tokens;
        const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;
        const looksLikeReasoningOnly =
          finish === "length" &&
          typeof completionTokens === "number" &&
          typeof reasoningTokens === "number" &&
          completionTokens > 0 &&
          completionTokens === reasoningTokens;

        if (hasContent && trimmed.length > 0) return content as string;

        if (looksLikeReasoningOnly && attempt === 1) {
          return await doFetch(2, Math.min(maxTok * 2, 16000));
        }

        throw new Error(`OPENAI_EMPTY_CONTENT(length=${finish}, attempt=${attempt})`);
      } finally {
        clearTimeout(t);
      }
    };

    return await doFetch(1, initialMax);
  }

  private async generateViaResponses(args: LlmGenerateArgs, runId: string): Promise<string> {
    const initialMax = args.max_tokens_override ?? args.max_tokens ?? this.maxOutputTokens;
    const baseBody: any = {
      model: this.model,
      input: [
        { role: "developer", content: args.system },
        { role: "user", content: args.user },
      ],
      max_output_tokens: initialMax,
      reasoning: { effort: "low" },
    };

    const doFetch = async (attempt: number, maxTok: number): Promise<string> => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/v1/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(runId ? { "X-Client-Request-Id": runId } : {}),
          },
          signal: ac.signal,
          body: JSON.stringify({ ...baseBody, max_output_tokens: maxTok }),
        });
        const rawText = await res.text();
        if (!res.ok) {
          throw new Error(`OPENAI_HTTP_${res.status}: ${rawText}`);
        }
        const json = JSON.parse(rawText);
        const outputText = typeof json?.output_text === "string" ? json.output_text : "";

        const composed = this.composeResponsesOutput(json);
        const picked = outputText?.trim().length ? outputText : composed;
        const hasContent = picked.trim().length > 0;

        this.logResponsesMeta({
          runId,
          model: this.model,
          status: res.status,
          usage: json?.usage ?? null,
          outputText: picked,
          rawJson: json,
        });

        if (hasContent) return picked;

        if (attempt === 1) {
          return await doFetch(2, Math.min(maxTok * 2, 20000));
        }
        throw new Error("OPENAI_EMPTY_OUTPUT_TEXT(responses)");
      } finally {
        clearTimeout(t);
      }
    };

    return await doFetch(1, initialMax);
  }

  private composeResponsesOutput(json: any): string {
    let composed = "";
    const out = json?.output;
    if (!Array.isArray(out)) return composed;
    for (const item of out) {
      const contentArr = item?.content;
      if (!Array.isArray(contentArr)) continue;
      for (const part of contentArr) {
        if (part?.type === "output_text" && typeof part?.text === "string") {
          composed += part.text;
        }
      }
    }
    return composed;
  }

  private logOkMeta(args: {
    runId: string;
    model: string;
    status: number;
    choicesLen: number | null;
    finishReason: string | null;
    usage: unknown;
    content: unknown;
    rawJson: unknown;
  }) {
    if (!isDebugEnabled()) return;
    const hasContent = typeof args.content === "string";
    const pv = hasContent ? safePreview(redactSecrets(args.content as string)) : { len: 0, head: "", tail: "" };
    // eslint-disable-next-line no-console
    console.log("[LLM_OK_META]", {
      run_id: args.runId,
      model: args.model,
      status: args.status,
      choices_len: args.choicesLen,
      finish_reason: args.finishReason,
      usage: args.usage ?? null,
      has_content: hasContent,
      content_len: pv.len,
      content_head: pv.head,
      content_tail: pv.tail,
    });
    if (!hasContent) {
      const j = JSON.stringify(args.rawJson);
      const jp = safePreview(redactSecrets(j), 1500, 0);
      // eslint-disable-next-line no-console
      console.log("[LLM_OK_NO_CONTENT_JSON_PREVIEW]", {
        run_id: args.runId,
        json_len: jp.len,
        json_head: jp.head,
      });
    }
  }

  private logResponsesMeta(args: {
    runId: string;
    model: string;
    status: number;
    usage: unknown;
    outputText: string;
    rawJson: unknown;
  }) {
    if (!isDebugEnabled()) return;
    const pv = safePreview(redactSecrets(args.outputText ?? ""));
    // eslint-disable-next-line no-console
    console.log("[LLM_OK_META]", {
      run_id: args.runId,
      model: args.model,
      status: args.status,
      choices_len: null,
      finish_reason: (args.rawJson as any)?.finish_reason ?? null,
      usage: args.usage ?? null,
      has_content: pv.len > 0,
      content_len: pv.len,
      content_head: pv.head,
      content_tail: pv.tail,
    });
    if (!pv.len) {
      const j = JSON.stringify(args.rawJson);
      const jp = safePreview(redactSecrets(j), 1500, 0);
      // eslint-disable-next-line no-console
      console.log("[LLM_OK_NO_CONTENT_JSON_PREVIEW]", {
        run_id: args.runId,
        json_len: jp.len,
        json_head: jp.head,
      });
    }
  }
}

export function createLlmClient(mode: "mock" | "openai"): LlmClient {
  if (mode !== "openai") return new MockLlmClient();

  return new OpenAiClient({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    defaultTemp: env.OPENAI_TEMPERATURE,
    maxCompletionTokens: env.OPENAI_MAX_COMPLETION_TOKENS,
    maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
    apiStyle: env.OPENAI_API_STYLE,
  });
}
