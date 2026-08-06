/**
 * Phase E.1d.1 — ABYSSAL VERDICT commit math + aftermath finalization contract.
 * Pure helpers — combat hub applies mutations.
 */
import { COMBAT_ACTION } from '../types/run';
import type { WeaponUltimateGrade } from '../types/weaponUltimateInteraction';
import { resolveWeaponUltimateGrade } from './weaponUltimateGradeEngine';
import { buildSimplifiedUltimateRawResult } from './weaponUltimateInputAdapter';

export type AbyssalVerdictStagedCommit = {
  grade: WeaponUltimateGrade;
  hits: number;
  damage: number;
};

const HITS_BY_GRADE: Record<WeaponUltimateGrade, number> = {
  STANDARD: 1,
  CLEAN: 2,
  PERFECT: 3,
};

/** Scale slice damage the same way the hub does for EVISCERATE commits. */
export function scaleAbyssalVerdictDamage(
  base: number,
  sliceDamagePenalty: number,
): number {
  if (sliceDamagePenalty > 0) {
    return Math.floor(base * (1 - sliceDamagePenalty));
  }
  return base;
}

/** Map grade → effective slice hits for the 11 / 23 / 35 matrix. */
export function abyssalVerdictHitsForGrade(grade: WeaponUltimateGrade): number {
  return HITS_BY_GRADE[grade];
}

/** Damage for an already-resolved grade (preserves 11 / 23 / 35). */
export function abyssalVerdictDamageForGrade(
  grade: WeaponUltimateGrade,
  sliceDamagePenalty = 0,
): number {
  const base = scaleAbyssalVerdictDamage(COMBAT_ACTION.EVISCERATE_DAMAGE, sliceDamagePenalty);
  const hits = abyssalVerdictHitsForGrade(grade);
  return hits >= 3 ? base : Math.floor(base * (hits / 3));
}

/**
 * Resolve commit damage from authoritative grade/input state.
 * Never awards PERFECT merely because input mode is FULL / targeting is open.
 */
export function resolveAbyssalVerdictCommitFromGradeInput(input: {
  simplifiedInputs?: boolean;
  /** Slice / grade-engine hit count (1–3). */
  hitCount?: number;
  /** Explicit staged grade (wins over hitCount when set). */
  grade?: WeaponUltimateGrade;
  sliceDamagePenalty?: number;
}): AbyssalVerdictStagedCommit {
  const penalty = input.sliceDamagePenalty ?? 0;
  if (input.simplifiedInputs) {
    const resolved = resolveWeaponUltimateGrade(buildSimplifiedUltimateRawResult('THREEFOLD_BRAND'));
    const grade = resolved.grade;
    const hits = resolved.effectiveHits ?? abyssalVerdictHitsForGrade(grade);
    return {
      grade,
      hits,
      damage: abyssalVerdictDamageForGrade(grade, penalty),
    };
  }
  if (input.grade) {
    const hits = abyssalVerdictHitsForGrade(input.grade);
    return {
      grade: input.grade,
      hits,
      damage: abyssalVerdictDamageForGrade(input.grade, penalty),
    };
  }
  if (typeof input.hitCount === 'number') {
    const resolved = resolveWeaponUltimateGrade({ hitCount: input.hitCount });
    const hits = resolved.effectiveHits ?? Math.max(1, Math.min(3, Math.floor(input.hitCount)));
    return {
      grade: resolved.grade,
      hits,
      damage: abyssalVerdictDamageForGrade(resolved.grade, penalty),
    };
  }
  // No grade state yet — STANDARD floor (never implicit PERFECT).
  return {
    grade: 'STANDARD',
    hits: 1,
    damage: abyssalVerdictDamageForGrade('STANDARD', penalty),
  };
}

/**
 * Aftermath finalization gate for a successfully committed ABYSSAL VERDICT.
 * Mandatory action-level work is not conditional on target survival.
 */
export function planAbyssalVerdictAftermath(input: {
  /** True only after a successful ultimate commit began resolving damage. */
  commitSucceeded: boolean;
  /** True when this commitment already finalized aftermath. */
  alreadyFinalized: boolean;
  /** Living enemy unit ids after damage resolution (primary dead ⇒ absent). */
  livingEnemyIdsAfterDamage: readonly string[];
}): {
  shouldFinalize: boolean;
  /** Survivor-only strip targets — never includes a dead primary. */
  stripTargetIds: string[];
  flushReserve: boolean;
} {
  if (!input.commitSucceeded || input.alreadyFinalized) {
    return { shouldFinalize: false, stripTargetIds: [], flushReserve: false };
  }
  return {
    shouldFinalize: true,
    stripTargetIds: [...input.livingEnemyIdsAfterDamage],
    flushReserve: true,
  };
}

/** Brands must be unchanged by ultimate aftermath (pass-through for probes). */
export function abyssalVerdictPreservesBrands(brandsBefore: number): number {
  return brandsBefore;
}
