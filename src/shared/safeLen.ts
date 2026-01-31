export function safeArrayLen<T>(arr: readonly T[] | null | undefined): number {
  return arr?.length ?? 0;
}

export function safeStrLen(s: string | null | undefined): number {
  return s?.length ?? 0;
}
