export function safePreview(text: string, head = 800, tail = 200) {
  if (!text) return { len: 0, head: "", tail: "" };
  const len = text.length;
  const h = text.slice(0, Math.min(head, len));
  const t = len > head ? text.slice(Math.max(0, len - tail), len) : "";
  return { len, head: h, tail: t };
}

export function redactSecrets(text: string) {
  if (!text) return text;
  // Basic API key redaction patterns
  return text
    .replace(/sk-[a-zA-Z0-9-_]{10,}/g, "sk-***REDACTED***")
    .replace(/Bearer\s+sk-[a-zA-Z0-9-_]{10,}/g, "Bearer sk-***REDACTED***");
}
