function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortDeep(obj[k]);
    return out;
  }
  return value;
}

export function canonicalizeJson(obj: unknown): string {
  return JSON.stringify(sortDeep(obj));
}
