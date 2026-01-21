import { debugLog } from "./debug";

type Entry = { value: unknown; createdAt: number };

type Store = Map<string, Entry>;

function getGlobalCache(): Store {
  const g = globalThis as unknown as { __agentCacheStore?: Store };
  if (!g.__agentCacheStore) g.__agentCacheStore = new Map<string, Entry>();
  return g.__agentCacheStore;
}

export class CacheStore {
  private store = getGlobalCache();

  get<T>(key: string): T | undefined {
    const e = this.store.get(key);
    debugLog("CACHE", `${e ? "hit" : "miss"} key=${formatKey(key)}`);
    return e ? (e.value as T) : undefined;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, createdAt: Date.now() });
    debugLog("CACHE", `set key=${formatKey(key)}`);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

function formatKey(key: string): string {
  return key.length > 80 ? `${key.slice(0, 80)}...` : key;
}
