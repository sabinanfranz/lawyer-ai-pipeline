import { debugLog, isDebugEnabled } from "./debug";
import { safePreview, redactSecrets } from "./logSafe";
import { env } from "@/server/env";

export type LlmGenerateArgs = {
  system: string;
  user: string;
  temperature?: number;
  max_tokens?: number;
  run_id?: string;
};

export interface LlmClient {
  generateText(args: LlmGenerateArgs): Promise<string>;
}

function isReasoningLikeModel(model: string): boolean {
  // gpt-5* and o-series tend to have stricter parameter support on Chat Completions.
  // If future models require this too, extend here.
  const m = (model ?? "").toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("o");
}

export class MockLlmClient implements LlmClient {
  async generateText(): Promise<string> {
    throw new Error("LLM_DISABLED");
  }
}

export class OpenAiChatCompletionsClient implements LlmClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;
  private defaultTemp: number;
  private defaultMaxTokens: number;

  constructor(args: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    defaultTemp: number;
    defaultMaxTokens: number;
  }) {
    this.apiKey = args.apiKey;
    this.baseUrl = args.baseUrl.replace(/\/$/, "");
    this.model = args.model;
    this.timeoutMs = args.timeoutMs;
    this.defaultTemp = args.defaultTemp;
    this.defaultMaxTokens = args.defaultMaxTokens;
  }

  async generateText(args: LlmGenerateArgs): Promise<string> {
    let loggedError = false;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    const runId = args.run_id ?? "n/a";
    const reasoningLike = isReasoningLikeModel(this.model);

    if (isDebugEnabled()) {
      const logTemp = reasoningLike ? "omitted" : args.temperature ?? this.defaultTemp;
      debugLog(
        "LLM_CALL",
        `model=${this.model} base=${this.baseUrl} timeout=${this.timeoutMs} max_completion_tokens=${args.max_tokens ?? this.defaultMaxTokens} temperature=${logTemp} run_id=${runId}`
      );
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          // IMPORTANT:
          // Chat Completions API supports `max_completion_tokens` and `max_tokens` is deprecated
          // and not compatible with some models. Use `max_completion_tokens`.
          max_completion_tokens: args.max_tokens ?? this.defaultMaxTokens,
          // Some reasoning-like models may reject temperature; omit it for safety.
          ...(reasoningLike ? {} : { temperature: args.temperature ?? this.defaultTemp }),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isDebugEnabled()) {
          debugLog("LLM_ERR", `status=${res.status}`, { message: text, run_id: runId });
          loggedError = true;
        }
        throw new Error(`OPENAI_HTTP_${res.status}: ${text}`);
      }

      const json = (await res.json()) as any;
      const choice0 = json?.choices?.[0];
      const content = choice0?.message?.content;

      if (isDebugEnabled()) {
        const finish = choice0?.finish_reason ?? null;
        const usage = json?.usage ?? null;
        const hasContent = typeof content === "string";
        const pv = hasContent ? safePreview(redactSecrets(content)) : { len: 0, head: "", tail: "" };
        // eslint-disable-next-line no-console
        console.log("[LLM_OK_META]", {
          run_id: runId,
          model: this.model,
          status: res.status,
          choices_len: Array.isArray(json?.choices) ? json.choices.length : null,
          finish_reason: finish,
          usage,
          has_content: hasContent,
          content_len: pv.len,
          content_head: pv.head,
          content_tail: pv.tail,
        });
        if (!hasContent) {
          const j = JSON.stringify(json);
          const jp = safePreview(redactSecrets(j), 1500, 0);
          // eslint-disable-next-line no-console
          console.log("[LLM_OK_NO_CONTENT_JSON_PREVIEW]", {
            run_id: runId,
            json_len: jp.len,
            json_head: jp.head,
          });
        }
      }

      if (typeof content !== "string") {
        const err = new Error("OPENAI_EMPTY_CONTENT");
        if (isDebugEnabled()) {
          debugLog("LLM_ERR", `status=200 message="${err.message}"`, { run_id: runId });
          loggedError = true;
        }
        throw err;
      }
      return content;
    } catch (err) {
      if (isDebugEnabled() && loggedError === false) {
        const message = err instanceof Error ? err.message : String(err);
        debugLog("LLM_ERR", `message="${message}"`, { run_id: runId });
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
}

export function createLlmClient(mode: "mock" | "openai"): LlmClient {
  if (mode !== "openai") return new MockLlmClient();

  return new OpenAiChatCompletionsClient({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    defaultTemp: env.OPENAI_TEMPERATURE,
    defaultMaxTokens: env.OPENAI_MAX_TOKENS,
  });
}
