export function track(event: string, props?: Record<string, unknown>) {
  if ((process.env.DEBUG_AGENT ?? "0") !== "1") return;
  // eslint-disable-next-line no-console
  console.log(`[telemetry] ${event}`, props ?? {});
}
