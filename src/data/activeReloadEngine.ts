import type { ActiveReloadResult } from '../types/classCombatResources';

export const ACTIVE_RELOAD_PASS_MS = 1200;

export interface ReloadZoneConfig {
  standardMax: number;
  perfectMin: number;
  perfectMax: number;
}

export const BASE_RELOAD_ZONES: ReloadZoneConfig = {
  standardMax: 0.60,
  perfectMin: 0.85,
  perfectMax: 0.95,
};

/** Scale perfect band width — 0.5 = Gunsmith's Curse (50% tighter window). */
export function buildReloadZoneConfig(perfectWindowScale = 1): ReloadZoneConfig {
  const scale = Math.max(0.25, Math.min(1, perfectWindowScale));
  const center = (BASE_RELOAD_ZONES.perfectMin + BASE_RELOAD_ZONES.perfectMax) / 2;
  const halfWidth = ((BASE_RELOAD_ZONES.perfectMax - BASE_RELOAD_ZONES.perfectMin) / 2) * scale;
  return {
    standardMax: BASE_RELOAD_ZONES.standardMax,
    perfectMin: Math.max(BASE_RELOAD_ZONES.standardMax, center - halfWidth),
    perfectMax: Math.min(1, center + halfWidth),
  };
}

/** Single-pass reload zones (ratio 0–1 left to right). */
export function resolveActiveReloadZone(
  cursorRatio: number,
  config: ReloadZoneConfig = BASE_RELOAD_ZONES,
): ActiveReloadResult {
  const ratio = Math.max(0, Math.min(1, cursorRatio));
  if (ratio >= config.perfectMin && ratio <= config.perfectMax) return 'PERFECT';
  if (ratio >= 0 && ratio <= config.standardMax) return 'STANDARD';
  return 'JAM';
}

export function activeReloadLogLine(result: ActiveReloadResult): string {
  switch (result) {
    case 'PERFECT':
      return '>> [ACTIVE RELOAD] PERFECT — magazine topped off, OVERCHARGED primed.';
    case 'STANDARD':
      return '>> [ACTIVE RELOAD] STANDARD — magazine topped off (−1 AP).';
    case 'JAM':
      return '>> [ACTIVE RELOAD] JAM — feed failure, weapon locked.';
    default:
      return '>> [ACTIVE RELOAD] COMPLETE.';
  }
}
