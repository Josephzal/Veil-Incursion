/**
 * WU-3 — map minigame raw metrics → STANDARD / CLEAN / PERFECT.
 * Cancel is free (no spend). Imperfect commits still floor at STANDARD.
 */
import type {
  WeaponUltimateGrade,
  WeaponUltimateRawPerformance,
  WeaponUltimateResolvedPerformance,
} from '../types/weaponUltimateInteraction';
import type { ZeroProtocolPerformance } from './hexZeroProtocolEngine';

/** Tap thresholds for Zero Protocol (FULL mode). */
export const ZERO_PROTOCOL_GRADE_TAPS = {
  CLEAN: 5,
  PERFECT: 10,
} as const;

/**
 * Resolve a shared ultimate grade from raw minigame metrics.
 * Simplified / forceStandard always yields STANDARD.
 */
export function resolveWeaponUltimateGrade(
  raw: WeaponUltimateRawPerformance,
): WeaponUltimateResolvedPerformance {
  if (raw.forceStandard) {
    return {
      grade: 'STANDARD',
      raw,
      effectiveTaps: typeof raw.tapCount === 'number' ? Math.max(1, raw.tapCount) : 1,
      effectiveNodes: typeof raw.nodesCompleted === 'number' ? Math.max(1, raw.nodesCompleted) : 1,
      effectiveHits: typeof raw.hitCount === 'number' ? Math.max(1, raw.hitCount) : 1,
    };
  }

  if (typeof raw.tapCount === 'number') {
    const taps = Math.max(0, raw.tapCount);
    let grade: WeaponUltimateGrade = 'STANDARD';
    if (taps >= ZERO_PROTOCOL_GRADE_TAPS.PERFECT) grade = 'PERFECT';
    else if (taps >= ZERO_PROTOCOL_GRADE_TAPS.CLEAN) grade = 'CLEAN';
    return {
      grade,
      raw,
      // STANDARD floor: even 0 taps still commit baseline performance.
      effectiveTaps: Math.max(1, taps),
    };
  }

  if (typeof raw.nodesCompleted === 'number') {
    const nodes = Math.max(0, Math.min(3, Math.floor(raw.nodesCompleted)));
    let grade: WeaponUltimateGrade = 'STANDARD';
    if (nodes >= 3) grade = 'PERFECT';
    else if (nodes === 2) grade = 'CLEAN';
    else grade = 'STANDARD';
    return {
      grade,
      raw,
      // STANDARD floor: 0 nodes → treat as 1 (no backlash).
      effectiveNodes: Math.max(1, nodes),
    };
  }

  if (typeof raw.hitCount === 'number') {
    const hits = Math.max(0, Math.min(3, Math.floor(raw.hitCount)));
    let grade: WeaponUltimateGrade = 'STANDARD';
    if (hits >= 3) grade = 'PERFECT';
    else if (hits === 2) grade = 'CLEAN';
    else grade = 'STANDARD';
    return {
      grade,
      raw,
      // STANDARD floor: 0 hits → treat as 1 (no zero-damage waste).
      effectiveHits: Math.max(1, hits),
    };
  }

  return {
    grade: 'STANDARD',
    raw,
    effectiveTaps: 1,
    effectiveNodes: 1,
    effectiveHits: 1,
  };
}

/** Bridge shared grades into the existing Zero Protocol performance vocabulary. */
export function gradeToZeroProtocolPerformance(
  grade: WeaponUltimateGrade,
): ZeroProtocolPerformance {
  if (grade === 'PERFECT') return 'PERFECT';
  if (grade === 'CLEAN') return 'GOOD';
  return 'POOR';
}

export function formatWeaponUltimateGradeLabel(grade: WeaponUltimateGrade): string {
  return grade;
}

/** Cancel never spends meters / charges / reserve. */
export function weaponUltimateCancelSpendsResources(): false {
  return false;
}

/** Open never spends — spend happens only on commit. */
export function weaponUltimateOpenSpendsResources(): false {
  return false;
}
