import type { ActiveReloadResult } from '../types/classCombatResources';

export const ACTIVE_RELOAD_PASS_MS = 1200;

export interface ReloadZoneConfig {
  perfectMin: number;
  perfectMax: number;
}

export const BASE_RELOAD_ZONES: ReloadZoneConfig = {
  perfectMin: 0.85,
  perfectMax: 0.95,
};

/** Scale perfect band width — 0.5 = Gunsmith's Curse (50% tighter window). */
export function buildReloadZoneConfig(perfectWindowScale = 1): ReloadZoneConfig {
  const scale = Math.max(0.25, Math.min(1, perfectWindowScale));
  const center = (BASE_RELOAD_ZONES.perfectMin + BASE_RELOAD_ZONES.perfectMax) / 2;
  const halfWidth = ((BASE_RELOAD_ZONES.perfectMax - BASE_RELOAD_ZONES.perfectMin) / 2) * scale;
  return {
    perfectMin: Math.max(0, center - halfWidth),
    perfectMax: Math.min(1, center + halfWidth),
  };
}

/** Single-pass reload — gold band is perfect; everything else is a jam (−20 STM). */
export function resolveActiveReloadZone(
  cursorRatio: number,
  config: ReloadZoneConfig = BASE_RELOAD_ZONES,
): ActiveReloadResult {
  const ratio = Math.max(0, Math.min(1, cursorRatio));
  if (ratio >= config.perfectMin && ratio <= config.perfectMax) return 'PERFECT';
  return 'JAM';
}

export function activeReloadLogLine(
  result: ActiveReloadResult,
  overchargePct: number,
): string {
  if (result === 'PERFECT') {
    if (overchargePct <= 0) {
      return '>> [PHASE-SHIFT RELOAD] PERFECT — magazine topped off. Quiet cycle, no overcharge.';
    }
    return `>> [PHASE-SHIFT RELOAD] PERFECT — magazine topped off. Overcharge +${Math.round(overchargePct * 100)}% primed.`;
  }
  return `>> [PHASE-SHIFT RELOAD] JAM — void-feed backlash rips ${20} Stamina.`;
}
