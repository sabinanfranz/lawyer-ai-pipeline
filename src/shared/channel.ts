// Channel SSOT shared by UI and server. Avoid node-only deps in this module.
export const CHANNELS = ['naver', 'linkedin', 'threads'] as const;
export type Channel = (typeof CHANNELS)[number];

// Display order shared across surfaces (Naver → LinkedIn → Threads)
export const CHANNEL_ORDER: readonly Channel[] = ['naver', 'linkedin', 'threads'] as const;

// UI labels centralized to prevent scattered literals
export const CHANNEL_LABEL: Record<Channel, string> = {
  naver: '네이버',
  linkedin: 'LinkedIn',
  threads: 'Threads',
} as const;

// Runtime type guard
export function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);
}
