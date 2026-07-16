import type { ActiveReloadResult } from '../types/classCombatResources';
import type { ReloadQuality } from '../types/hexAmmo';

export const ACTIVE_RELOAD_PASS_MS = 1200;

export interface ReloadZoneConfig {
  perfectMin: number;
  perfectMax: number;
  /** Below this ratio = FAILED; between here and the perfect band = CLEAN. */
  cleanMin: number;
}

export const BASE_RELOAD_ZONES: ReloadZoneConfig = {
  perfectMin: 0.85,
  perfectMax: 0.95,
  cleanMin: 0.6,
};

/** Scale perfect band width — 0.5 = Gunsmith's Curse (50% tighter window). */
export function buildReloadZoneConfig(perfectWindowScale = 1): ReloadZoneConfig {
  const scale = Math.max(0.25, Math.min(1, perfectWindowScale));
  const center = (BASE_RELOAD_ZONES.perfectMin + BASE_RELOAD_ZONES.perfectMax) / 2;
  const halfWidth = ((BASE_RELOAD_ZONES.perfectMax - BASE_RELOAD_ZONES.perfectMin) / 2) * scale;
  return {
    perfectMin: Math.max(0, center - halfWidth),
    perfectMax: Math.min(1, center + halfWidth),
    cleanMin: BASE_RELOAD_ZONES.cleanMin,
  };
}

/** Legacy two-tier resolver — gold band is perfect; everything else jams. */
export function resolveActiveReloadZone(
  cursorRatio: number,
  config: ReloadZoneConfig = BASE_RELOAD_ZONES,
): ActiveReloadResult {
  const ratio = Math.max(0, Math.min(1, cursorRatio));
  if (ratio >= config.perfectMin && ratio <= config.perfectMax) return 'PERFECT';
  return 'JAM';
}

/**
 * Three-tier reload resolution for the ammo-type refactor:
 * gold band = PERFECT (Protocol + Overcharged), near band = CLEAN (no penalty),
 * far miss = FAILED (light −10% first-shot penalty). Reload always refills.
 */
export function resolveActiveReloadQuality(
  cursorRatio: number,
  config: ReloadZoneConfig = BASE_RELOAD_ZONES,
): ReloadQuality {
  const ratio = Math.max(0, Math.min(1, cursorRatio));
  if (ratio >= config.perfectMin && ratio <= config.perfectMax) return 'PERFECT';
  if (ratio >= config.cleanMin) return 'CLEAN';
  return 'FAILED';
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
