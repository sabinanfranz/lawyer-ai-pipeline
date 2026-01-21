import { debugLog, isDebugEnabled, maskKey } from "@/agent_core/debug";

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  LLM_MODE: (process.env.LLM_MODE ?? "mock") as "mock" | "openai",
  DEBUG_AGENT: process.env.DEBUG_AGENT ?? "0",

  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  OPENAI_TIMEOUT_MS: num(process.env.OPENAI_TIMEOUT_MS, 30000),
  OPENAI_MAX_TOKENS: num(process.env.OPENAI_MAX_TOKENS, 2200),
  OPENAI_TEMPERATURE: num(process.env.OPENAI_TEMPERATURE, 0.2),

  DATABASE_URL: process.env.DATABASE_URL ?? "",
} as const;

let loggedOnce = false;
export function effectiveLlmMode(): "mock" | "openai" {
  const effective =
    env.LLM_MODE === "openai" && env.OPENAI_API_KEY ? ("openai" as const) : ("mock" as const);

  if (isDebugEnabled() && !loggedOnce) {
    loggedOnce = true;
    debugLog(
      "ENV",
      `LLM_MODE=${env.LLM_MODE} key=${maskKey(env.OPENAI_API_KEY)} effective=${effective}`
    );
  }

  return effective;
}
