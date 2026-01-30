function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v == null) return defaultValue;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

/**
 * PR-0: flag만 추가. 아직 어떤 코드 경로도 이 값을 사용하지 않는다.
 * PR-1+에서 draft agents를 텍스트 모드로 전환하는 데 사용 예정.
 */
export const DRAFT_LOOSE_MODE = envBool("DRAFT_LOOSE_MODE", false);
