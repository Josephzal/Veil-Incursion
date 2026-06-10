import type { RunNodeType } from '../types/game';
import { applyResonanceAdjustment } from './resonanceProgressionEngine';
import { districtMultiplier, type DistrictId } from './districtPacing';

export const SCAN_PENALTY = 15;
export const CLEAR_VENT = 25;

/** Unified resonance zone thresholds (patrol + escalations). */
export const RESONANCE_ZONE_SAFE_MAX = 40;
export const RESONANCE_ZONE_ALERT_MAX = 75;

export function computeScanPenalty(district: DistrictId): number {
  return Math.round(SCAN_PENALTY * districtMultiplier(district) * 10) / 10;
}

export function computeClearVent(): number {
  return CLEAR_VENT;
}

export function clampResonanceDelta(
  currentPercent: number,
  delta: number,
  collapseActive = false,
): number {
  return applyResonanceAdjustment(currentPercent, delta, collapseActive);
}

export function isCombatVentNode(type?: RunNodeType): boolean {
  return type === 'STANDARD_COMBAT'
    || type === 'ELITE_COMBAT'
    || type === 'BOSS_COMBAT';
}

export type ResonanceZone = 'SAFE' | 'ALERT' | 'CRITICAL';

export function getResonanceZone(percent: number): ResonanceZone {
  if (percent <= RESONANCE_ZONE_SAFE_MAX) return 'SAFE';
  if (percent <= RESONANCE_ZONE_ALERT_MAX) return 'ALERT';
  return 'CRITICAL';
}
