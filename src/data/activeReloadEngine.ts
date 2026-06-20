import type { ActiveReloadResult } from '../types/classCombatResources';

/** Resolve active-reload outcome from cursor position (0–1) on the timing bar. */
export function resolveActiveReloadZone(
  cursorRatio: number,
  perfectWindowScale = 1,
): ActiveReloadResult {
  const clamped = Math.max(0, Math.min(1, cursorRatio));
  const distFromCenter = Math.abs(clamped - 0.5);
  const perfectWindow = 0.06 * perfectWindowScale;
  const goodWindow = 0.15;
  if (distFromCenter <= perfectWindow) return 'PERFECT';
  if (distFromCenter <= goodWindow) return 'GOOD';
  return 'FAIL';
}

export function activeReloadLogLine(result: ActiveReloadResult): string {
  switch (result) {
    case 'PERFECT':
      return '>> [ACTIVE RELOAD] PERFECT — magazine topped off, OVERCHARGED primed.';
    case 'GOOD':
      return '>> [ACTIVE RELOAD] GOOD — magazine topped off (−1 AP).';
    case 'FAIL':
      return '>> [ACTIVE RELOAD] FAIL — partial feed (2 rounds), turn forfeited.';
    default:
      return '>> [ACTIVE RELOAD] COMPLETE.';
  }
}
