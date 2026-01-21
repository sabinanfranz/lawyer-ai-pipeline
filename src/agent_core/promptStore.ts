import path from "path";
import { readFile } from "fs/promises";

export type PromptBundle = {
  system: string;
  user: string;
  repair: string;
  baseDir: string;
};

type PromptCache = Map<string, PromptBundle>;

function getGlobalPromptCache(): PromptCache {
  const g = globalThis as unknown as { __promptCache?: PromptCache };
  if (!g.__promptCache) g.__promptCache = new Map<string, PromptBundle>();
  return g.__promptCache;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ""));
}

export class PromptStore {
  private cache = getGlobalPromptCache();
  private promptsRoot: string;

  constructor(promptsRoot = path.join(process.cwd(), "prompts")) {
    this.promptsRoot = promptsRoot;
  }

  async load(args: { agent: string; variant: string; version: string }): Promise<PromptBundle> {
    const key = `${args.agent}:${args.variant}:${args.version}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const baseDir = path.join(this.promptsRoot, args.agent, args.variant, args.version);
    const [system, user, repair] = await Promise.all([
      readFile(path.join(baseDir, "system.txt"), "utf-8"),
      readFile(path.join(baseDir, "user.txt"), "utf-8"),
      readFile(path.join(baseDir, "repair.txt"), "utf-8"),
    ]);

    const bundle: PromptBundle = { system, user, repair, baseDir };
    this.cache.set(key, bundle);
    return bundle;
  }
}
