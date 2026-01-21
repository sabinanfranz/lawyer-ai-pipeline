export function isDebugEnabled(): boolean {
  return process.env.DEBUG_AGENT === "1";
}

function stringifyExtra(extra: unknown): string {
  try {
    const text = JSON.stringify(extra);
    if (!text) return "";
    const max = 500;
    return text.length > max ? `${text.slice(0, max)}...` : text;
  } catch {
    return "[unserializable]";
  }
}

export function debugLog(scope: string, msg: string, extra?: unknown) {
  if (!isDebugEnabled()) return;
  const extraText = extra === undefined ? "" : ` ${stringifyExtra(extra)}`;
  // eslint-disable-next-line no-console
  console.log(`[${scope}] ${msg}${extraText}`);
}

export function maskKey(key: string | undefined): string {
  if (!key) return "(empty)";
  const visible = key.slice(0, 6);
  return `${visible}***`;
}
