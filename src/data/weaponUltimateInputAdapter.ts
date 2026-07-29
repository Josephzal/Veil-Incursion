/**
 * WU-3 — accessibility / input adapter for weapon ultimates.
 * FULL = existing minigames. SIMPLIFIED = hold-confirm → forced STANDARD.
 */
import type {
  WeaponUltimateAccessibilityOptions,
  WeaponUltimateInputMode,
  WeaponUltimateRawPerformance,
} from '../types/weaponUltimateInteraction';

export function resolveWeaponUltimateInputMode(
  options: Pick<WeaponUltimateAccessibilityOptions, 'simplifiedUltimateInputs'>,
): WeaponUltimateInputMode {
  return options.simplifiedUltimateInputs ? 'SIMPLIFIED' : 'FULL';
}

/**
 * Timing window scale for FULL-mode interactions.
 * Reduced motion enlarges windows; simplified bypasses timing entirely.
 */
export function resolveWeaponUltimateTimingAssist(
  options: WeaponUltimateAccessibilityOptions,
): number {
  if (options.simplifiedUltimateInputs) return 1;
  if (options.reducedMotion) return 1.35;
  return 1;
}

/** Simplified confirm always commits STANDARD — never CLEAN/PERFECT. */
export function buildSimplifiedUltimateRawResult(
  kind: 'ZERO_PROTOCOL' | 'NULL_CIRCUIT' | 'THREEFOLD_BRAND',
): WeaponUltimateRawPerformance {
  if (kind === 'ZERO_PROTOCOL') {
    return { tapCount: 1, forceStandard: true };
  }
  if (kind === 'NULL_CIRCUIT') {
    return { nodesCompleted: 1, forceStandard: true };
  }
  return { hitCount: 1, forceStandard: true };
}

export function shouldSkipUltimateMinigame(inputMode: WeaponUltimateInputMode): boolean {
  return inputMode === 'SIMPLIFIED';
}
